-- One-way rentals: pickup and dropoff can now be different locker
-- locations. Backfilled from partner_id (same-location) for any existing
-- row, matching every booking made before this feature existed.
alter table bookings add column dropoff_partner_id uuid references partners(id);
update bookings set dropoff_partner_id = partner_id where dropoff_partner_id is null;
alter table bookings alter column dropoff_partner_id set not null;

-- Replaces 0012's create_locker_booking_atomic: the worker-schedule
-- re-check's existing-commitments query used b.partner_id for BOTH the
-- setup and return leg of every other booking, which was correct only
-- because pickup == dropoff was the only case that existed. It now uses
-- partner_id for the setup leg and dropoff_partner_id for the return leg,
-- and the candidate's own return leg is checked against p_dropoff_partner_id
-- instead of p_partner_id. Mirrors lib/locker-engine/workerSchedule.ts's
-- commitmentsForBooking(pickupPartnerId, dropoffPartnerId, ...) exactly.
drop function if exists create_locker_booking_atomic(uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, booking_source, text);

create or replace function create_locker_booking_atomic(
  p_customer_id uuid,
  p_partner_id uuid,
  p_dropoff_partner_id uuid,
  p_rental_package_id uuid,
  p_asset_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_secure_token text,
  p_source booking_source,
  p_referral_code text default null
)
returns bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_overnight boolean;
  v_booking bookings;
  v_stop_minutes constant int := 15;
  v_return_grace_minutes constant int := 10;
  v_worker_start_hour constant int := 7;
  v_setup_start timestamptz;
  v_setup_end timestamptz;
  v_return_start timestamptz;
  v_return_end timestamptz;
  v_floor timestamptz;
  rec record;
  prev record;
  v_travel_minutes int;
  v_available_at timestamptz;
begin
  select is_overnight into v_is_overnight from rental_packages where id = p_rental_package_id;
  if v_is_overnight is null then
    raise exception 'Rental package % not found', p_rental_package_id;
  end if;

  perform pg_advisory_xact_lock(hashtext('procam_worker_schedule_lock'));

  if not v_is_overnight then
    v_setup_start := p_start_time - make_interval(mins => v_stop_minutes);
    v_setup_end := p_start_time;
    v_return_start := p_end_time;
    v_return_end := p_end_time + make_interval(mins => v_return_grace_minutes + v_stop_minutes);

    v_floor := date_trunc('day', v_setup_start at time zone 'Asia/Kuala_Lumpur') at time zone 'Asia/Kuala_Lumpur' + make_interval(hours => v_worker_start_hour);
    if v_setup_start < v_floor then
      raise exception 'INFEASIBLE: setup commitment falls before the worker''s day starts';
    end if;
    v_floor := date_trunc('day', v_return_start at time zone 'Asia/Kuala_Lumpur') at time zone 'Asia/Kuala_Lumpur' + make_interval(hours => v_worker_start_hour);
    if v_return_start < v_floor then
      raise exception 'INFEASIBLE: return commitment falls before the worker''s day starts';
    end if;

    prev := null;
    for rec in (
      select partner_id, start_ts, end_ts from (
        select b.partner_id,
               b.start_time - make_interval(mins => v_stop_minutes) as start_ts,
               b.start_time as end_ts
        from bookings b
        where b.status not in ('CANCELLED', 'EXPIRED', 'COMPLETED')
        union all
        select b.dropoff_partner_id,
               b.end_time as start_ts,
               b.end_time + make_interval(mins => v_return_grace_minutes + v_stop_minutes) as end_ts
        from bookings b
        where b.status not in ('CANCELLED', 'EXPIRED', 'COMPLETED')
        union all
        select p_partner_id, v_setup_start, v_setup_end
        union all
        select p_dropoff_partner_id, v_return_start, v_return_end
      ) all_commitments
      order by start_ts
    )
    loop
      if prev is not null then
        if prev.partner_id = rec.partner_id then
          v_travel_minutes := 0;
        else
          select t.minutes into v_travel_minutes
          from location_travel_times t
          where t.from_partner_id = prev.partner_id and t.to_partner_id = rec.partner_id;
          if v_travel_minutes is null then
            raise exception 'INFEASIBLE: no travel-time route between the worker''s consecutive stops';
          end if;
        end if;

        v_available_at := prev.end_ts + make_interval(mins => v_travel_minutes);
        if v_available_at > rec.start_ts then
          raise exception 'INFEASIBLE: worker cannot reach the next commitment in time';
        end if;
      end if;
      prev := rec;
    end loop;
  end if;

  insert into bookings (
    secure_token, customer_id, partner_id, dropoff_partner_id, rental_package_id, asset_id,
    status, start_time, end_time, source, referral_code
  ) values (
    p_secure_token, p_customer_id, p_partner_id, p_dropoff_partner_id, p_rental_package_id, p_asset_id,
    'PENDING_PAYMENT', p_start_time, p_end_time, p_source, p_referral_code
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke execute on function create_locker_booking_atomic(uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, booking_source, text) from public;
grant execute on function create_locker_booking_atomic(uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, booking_source, text) to service_role;

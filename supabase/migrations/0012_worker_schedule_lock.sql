-- The database-level backstop for worker-schedule feasibility that
-- lib/locker-engine/workerSchedule.ts's isWorkerScheduleFeasible has never
-- had (a known, previously-documented gap: only the asset/kit EXCLUDE
-- constraints gave inventory feasibility a real DB-level guarantee; two
-- concurrent bookings, each individually schedule-feasible against a
-- snapshot that didn't include the other, could otherwise both commit and
-- jointly be infeasible for the one worker to actually cover).
--
-- Mirrors workerSchedule.ts's constants and reachability check exactly
-- (STOP_MINUTES=15, RETURN_GRACE_MINUTES=10, WORKER_START_HOUR=7 — kept in
-- sync by hand, not by codegen; update both sides if either changes). The
-- TypeScript engine still does the actual SEARCH for a candidate slot
-- (lib/locker-engine/bookingGate.ts) — this function is only the final,
-- authoritative gate at commit time, taken under a global advisory lock so
-- no two callers can validate-then-insert concurrently. A single global
-- lock (rather than per-worker) is correct at the current one-worker scale
-- (see the `workers` table comment in 0001_init.sql) and would need to
-- become per-worker if a second worker is ever added.
--
-- The worker-start-hour floor is anchored to Malaysia local time
-- ('Asia/Kuala_Lumpur', a fixed +8h offset with no DST) rather than UTC or
-- the session's timezone — "the worker's day" belongs to a real person
-- living in Malaysia, not to whatever timezone happens to run this code.
-- lib/locker-engine/workerSchedule.ts's workerStartFloorFor mirrors this
-- exact anchor and must agree with it.
--
-- Overnight bookings skip this check entirely when THEY are the one being
-- created (checkOvernightBookingFeasibility never calls
-- isWorkerScheduleFeasible either) but still occupy the worker's schedule
-- as an existing commitment once created, exactly like workerSchedule.ts's
-- existingCommitments() — it derives commitments from every non-terminal
-- booking indiscriminately.
create or replace function create_locker_booking_atomic(
  p_customer_id uuid,
  p_partner_id uuid,
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
        select b.partner_id,
               b.end_time as start_ts,
               b.end_time + make_interval(mins => v_return_grace_minutes + v_stop_minutes) as end_ts
        from bookings b
        where b.status not in ('CANCELLED', 'EXPIRED', 'COMPLETED')
        union all
        select p_partner_id, v_setup_start, v_setup_end
        union all
        select p_partner_id, v_return_start, v_return_end
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
    secure_token, customer_id, partner_id, rental_package_id, asset_id,
    status, start_time, end_time, source, referral_code
  ) values (
    p_secure_token, p_customer_id, p_partner_id, p_rental_package_id, p_asset_id,
    'PENDING_PAYMENT', p_start_time, p_end_time, p_source, p_referral_code
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke execute on function create_locker_booking_atomic(uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, booking_source, text) from public;
grant execute on function create_locker_booking_atomic(uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, booking_source, text) to service_role;

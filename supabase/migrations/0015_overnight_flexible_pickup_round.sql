-- Every overnight booking shares one fixed network-wide start time (10pm)
-- and return time (8am), unlike daytime's per-customer chosen hour. Pinning
-- either to a rigid "worker must be live at that exact instant" commitment
-- (0014's fix) meant at most ONE overnight booking could ever be accepted
-- per night, network-wide, no matter how many cameras or locations exist
-- -- not what "however many cameras the worker can actually reach in time"
-- capacity should look like. Both legs are self-service (PIN pickup,
-- self-submitted return condition check -- no staff needed live at either
-- instant), so overnight bookings now create NO fixed worker-presence
-- commitments at all. Pickup feasibility is instead checked as a flexible
-- task that just needs to land somewhere before the 10pm deadline, via the
-- new overnight_round_min_finish helper (brute-forces every visiting order
-- -- cheap with a handful of locker locations, and the only way to never
-- wrongly reject an order that would actually have worked). Actual return
-- collection is a routing/collection concern, not this booking-acceptance
-- gate. Mirrors lib/locker-engine/workerSchedule.ts's
-- isOvernightRoundFeasible / commitmentsForBooking exactly.
create or replace function overnight_round_min_finish(
  p_anchor_time timestamptz,
  p_anchor_partner_id uuid,
  p_remaining uuid[],
  p_stop_minutes int
) returns timestamptz
language plpgsql
set search_path = public
as $$
declare
  best timestamptz := null;
  candidate timestamptz;
  next_partner uuid;
  next_remaining uuid[];
  travel int;
  i int;
begin
  if p_remaining is null or array_length(p_remaining, 1) is null then
    return p_anchor_time;
  end if;
  for i in 1..array_length(p_remaining, 1) loop
    next_partner := p_remaining[i];
    next_remaining := p_remaining[1:i-1] || p_remaining[i+1:array_length(p_remaining, 1)];
    if p_anchor_partner_id is null or p_anchor_partner_id = next_partner then
      travel := 0;
    else
      select t.minutes into travel from location_travel_times t
      where t.from_partner_id = p_anchor_partner_id and t.to_partner_id = next_partner;
      if travel is null then
        continue; -- no route to this stop from here; try a different order
      end if;
    end if;
    candidate := overnight_round_min_finish(
      p_anchor_time + make_interval(mins => travel + p_stop_minutes),
      next_partner,
      next_remaining,
      p_stop_minutes
    );
    if candidate is not null and (best is null or candidate < best) then
      best := candidate;
    end if;
  end loop;
  return best;
end;
$$;

revoke execute on function overnight_round_min_finish(timestamptz, uuid, uuid[], int) from public;
grant execute on function overnight_round_min_finish(timestamptz, uuid, uuid[], int) to service_role;

drop function if exists create_locker_booking_atomic(uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, booking_source, text);

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
  v_overnight_start_hour constant int := 22;
  v_setup_start timestamptz;
  v_setup_end timestamptz;
  v_return_start timestamptz;
  v_return_end timestamptz;
  v_floor timestamptz;
  v_night_deadline timestamptz;
  v_round_pickups uuid[];
  v_round_finish timestamptz;
  v_anchor_partner_id uuid;
  v_anchor_end timestamptz;
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

  -- Fixed worker-presence commitments: daytime setup/return legs only.
  -- Overnight bookings contribute none (see comment above); their pickups
  -- are handled entirely by the flexible round check below. Materialized
  -- into a temp table (transaction-scoped, auto-dropped) so both the
  -- sequential-chain check and the round check's anchor lookup can query
  -- it without duplicating this query twice.
  create temporary table tmp_fixed_commitments (
    partner_id uuid not null,
    start_ts timestamptz not null,
    end_ts timestamptz not null
  ) on commit drop;

  insert into tmp_fixed_commitments (partner_id, start_ts, end_ts)
  select b.partner_id,
         b.start_time - make_interval(mins => v_stop_minutes),
         b.start_time
  from bookings b
  join rental_packages rp on rp.id = b.rental_package_id
  where b.status not in ('CANCELLED', 'EXPIRED', 'COMPLETED') and not rp.is_overnight
  union all
  select b.dropoff_partner_id,
         b.end_time,
         b.end_time + make_interval(mins => v_return_grace_minutes + v_stop_minutes)
  from bookings b
  join rental_packages rp on rp.id = b.rental_package_id
  where b.status not in ('CANCELLED', 'EXPIRED', 'COMPLETED') and not rp.is_overnight;

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

    insert into tmp_fixed_commitments (partner_id, start_ts, end_ts)
    values (p_partner_id, v_setup_start, v_setup_end), (p_dropoff_partner_id, v_return_start, v_return_end);
  end if;

  -- Fixed-time worker-presence chain.
  prev := null;
  for rec in (select partner_id, start_ts, end_ts from tmp_fixed_commitments order by start_ts)
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

  -- Overnight pickup round: whichever night this booking touches -- its
  -- own night if overnight, or the same evening's 10pm cutoff if daytime
  -- (so a late daytime booking can't silently strand an already-confirmed
  -- overnight pickup) -- verify every overnight pickup due that night
  -- (existing confirmed ones, plus this one if it's overnight itself) can
  -- still be staged by the worker, in some order, before 10pm.
  v_night_deadline := date_trunc('day', p_start_time at time zone 'Asia/Kuala_Lumpur') at time zone 'Asia/Kuala_Lumpur' + make_interval(hours => v_overnight_start_hour);

  select coalesce(array_agg(b.partner_id), array[]::uuid[]) into v_round_pickups
  from bookings b
  join rental_packages rp on rp.id = b.rental_package_id
  where rp.is_overnight and b.status not in ('CANCELLED', 'EXPIRED', 'COMPLETED') and b.start_time = v_night_deadline;

  if v_is_overnight then
    v_round_pickups := array_append(v_round_pickups, p_partner_id);
  end if;

  if array_length(v_round_pickups, 1) > 0 then
    -- Anchor: wherever the worker's fixed schedule leaves them right
    -- before the deadline -- the latest fixed commitment that starts
    -- before it -- or the day's 7am floor with no location constraint if
    -- nothing precedes it that day (same convention as the first
    -- commitment of any day in the sequential chain above).
    select partner_id, end_ts into v_anchor_partner_id, v_anchor_end
    from tmp_fixed_commitments
    where start_ts < v_night_deadline
    order by start_ts desc
    limit 1;

    if v_anchor_end is null then
      v_anchor_end := date_trunc('day', v_night_deadline at time zone 'Asia/Kuala_Lumpur') at time zone 'Asia/Kuala_Lumpur' + make_interval(hours => v_worker_start_hour);
    end if;

    v_round_finish := overnight_round_min_finish(v_anchor_end, v_anchor_partner_id, v_round_pickups, v_stop_minutes);
    if v_round_finish is null or v_round_finish > v_night_deadline then
      raise exception 'INFEASIBLE: worker cannot complete tonight''s overnight pickups by 10pm';
    end if;
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

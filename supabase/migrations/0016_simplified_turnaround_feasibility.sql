-- Replaces the whole travel-time worker-presence commitment engine
-- (0012-0015) with a much simpler inventory rule: a camera is eligible for
-- a booking if it's already AVAILABLE, or its last occupying booking ended
-- at least ASSET_TURNAROUND_MINUTES (2 hours) before the new booking's
-- start -- regardless of either booking's location. Location and travel
-- time no longer gate whether a booking is accepted at all; that's now
-- purely the worker's routing problem (lib/locker-engine/routing.ts), not
-- a reason to reject a request outright. Mirrors
-- lib/locker-engine/feasibility.ts's isAssetReadyFor exactly.
--
-- The advisory lock is still needed: the turnaround rule isn't enforced by
-- a hard DB constraint (only true time-overlap is, via
-- no_overlapping_asset_bookings), so two concurrent requests could both
-- read "yes, clear of the buffer" for the same asset without it.
drop function if exists create_locker_booking_atomic(uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, booking_source, text);
drop function if exists overnight_round_min_finish(timestamptz, uuid, uuid[], int);

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
  v_package_exists boolean;
  v_asset_status asset_status;
  v_turnaround_minutes constant int := 120;
  v_cutoff timestamptz;
  v_still_turning_around boolean;
  v_booking bookings;
begin
  select true into v_package_exists from rental_packages where id = p_rental_package_id;
  if v_package_exists is null then
    raise exception 'Rental package % not found', p_rental_package_id;
  end if;

  perform pg_advisory_xact_lock(hashtext('procam_worker_schedule_lock'));

  select status into v_asset_status from rental_assets where id = p_asset_id for update;
  if v_asset_status is null then
    raise exception 'Asset % not found', p_asset_id;
  end if;

  if v_asset_status != 'AVAILABLE' then
    v_cutoff := p_start_time - make_interval(mins => v_turnaround_minutes);
    select exists (
      select 1 from bookings b
      where b.asset_id = p_asset_id
        and b.status not in ('CANCELLED', 'EXPIRED')
        and b.end_time <= p_start_time
        and b.end_time > v_cutoff
    ) into v_still_turning_around;

    if v_still_turning_around then
      raise exception 'INFEASIBLE: asset has not cleared its turnaround buffer yet';
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

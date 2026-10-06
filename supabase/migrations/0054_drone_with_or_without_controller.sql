-- A Neo 2 can be rented with or without its controller. The controller adds RM5 an hour; the hourly price, the late fee
-- and the deposit (drone RM800, controller RM400 more) all depend on it. The prices themselves live in
-- lib/droneRental/pricingRules.ts; the database records which option each booking and walk-in order chose.
--
-- Every row so far went out with its controller, so that is the default.

alter table dr_bookings add column with_controller boolean not null default true;
alter table dr_walkin_requests add column with_controller boolean not null default true;

-- Booking RPC: also records whether the controller is included.
drop function if exists create_drone_booking_atomic(uuid, uuid, uuid, timestamptz, timestamptz, numeric, numeric, text, dr_booking_source, uuid, smallint, text);

create or replace function create_drone_booking_atomic(
  p_customer_id uuid,
  p_shop_id uuid,
  p_drone_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_rental_fee_myr numeric,
  p_deposit_myr numeric,
  p_secure_token text,
  p_source dr_booking_source,
  p_created_by_staff_id uuid default null,
  p_batteries_count smallint default 2,
  p_drone_model text default 'NEO2',
  p_with_controller boolean default true
)
returns dr_bookings
language plpgsql
set search_path = public
as $$
declare
  v_booking dr_bookings;
begin
  insert into dr_bookings (
    customer_id, shop_id, drone_id, start_time, end_time,
    rental_fee_myr, deposit_myr, secure_token, source, created_by_staff_id,
    batteries_count, drone_model, with_controller, status
  ) values (
    p_customer_id, p_shop_id, p_drone_id, p_start_time, p_end_time,
    p_rental_fee_myr, p_deposit_myr, p_secure_token, p_source, p_created_by_staff_id,
    p_batteries_count, p_drone_model, p_with_controller, 'PENDING_PAYMENT'
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

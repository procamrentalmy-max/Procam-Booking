-- A second drone model, the GT50, alongside the DJI Neo 2. Everything that differs
-- by model (hourly rate, battery prices, deposit, whether handover needs photos)
-- lives in lib/droneRental/pricingRules.ts; the database only records which model
-- each drone is and which model each booking / walk-in order is for.
--
-- Existing rows are all Neo 2, so the default keeps them as they were.

alter table dr_drones
  add column model_key text not null default 'NEO2' check (model_key in ('NEO2', 'GT50'));

alter table dr_bookings
  add column drone_model text not null default 'NEO2' check (drone_model in ('NEO2', 'GT50'));

alter table dr_walkin_requests
  add column drone_model text not null default 'NEO2' check (drone_model in ('NEO2', 'GT50'));

-- The handover / return checklist differs by model: the Neo 2 keeps its full list,
-- the GT50 gets a short one. applies_to says which models an item is for.
alter table dr_checklist_items
  add column applies_to text[] not null default '{NEO2}';

insert into dr_checklist_items (item_key, label, sort_order, applies_to) values
  ('gt50_powers_on', 'Drone powers on and connects to the controller', 1, '{GT50}'),
  ('gt50_condition', 'Drone and propellers show no visible damage', 2, '{GT50}'),
  ('gt50_batteries', 'All the batteries handed out are present', 3, '{GT50}'),
  ('gt50_controller', 'Controller is present and working', 4, '{GT50}')
on conflict (item_key) do nothing;

-- Booking RPC: also records the model the booking is for.
drop function if exists create_drone_booking_atomic(uuid, uuid, uuid, timestamptz, timestamptz, numeric, numeric, text, dr_booking_source, uuid, smallint);

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
  p_drone_model text default 'NEO2'
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
    batteries_count, drone_model, status
  ) values (
    p_customer_id, p_shop_id, p_drone_id, p_start_time, p_end_time,
    p_rental_fee_myr, p_deposit_myr, p_secure_token, p_source, p_created_by_staff_id,
    p_batteries_count, p_drone_model, 'PENDING_PAYMENT'
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

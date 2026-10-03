-- The customer now chooses 1 or 2 batteries at booking (RM7 or RM10, on top of
-- RM10 per hour). Stored per booking so the handover, swap and return screens
-- know how many batteries this rental has. Existing rows are 2-battery rentals.
alter table dr_bookings
  add column batteries_count smallint not null default 2 check (batteries_count in (1, 2));

alter table dr_walkin_requests
  add column batteries_count smallint not null default 2 check (batteries_count in (1, 2));

drop function if exists create_drone_booking_atomic(uuid, uuid, uuid, timestamptz, timestamptz, numeric, numeric, text, dr_booking_source, uuid);

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
  p_batteries_count smallint default 2
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
    batteries_count, status
  ) values (
    p_customer_id, p_shop_id, p_drone_id, p_start_time, p_end_time,
    p_rental_fee_myr, p_deposit_myr, p_secure_token, p_source, p_created_by_staff_id,
    p_batteries_count, 'PENDING_PAYMENT'
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

update dr_checklist_items set label = 'All the batteries handed out are present' where item_key = 'batteries_present';

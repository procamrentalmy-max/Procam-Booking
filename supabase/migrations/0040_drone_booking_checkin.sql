-- Customer shows a booking QR at the shop; the merchant scans it and presses
-- "Accept order". checked_in_at records that, and makes the QR single-use:
-- once set, scanning it no longer offers the accept screen.
alter table dr_bookings
  add column checked_in_at timestamptz,
  add column checked_in_by_staff_id uuid references staff_users(id) on delete set null;

comment on column dr_bookings.checked_in_at is 'Set when the merchant scans the customer''s booking QR and presses Accept order. Once set, that QR no longer opens the accept screen.';

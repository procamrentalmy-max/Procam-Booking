-- A customer paying by QR (the walk-in rental fee, or a battery swap) tells the shop it is coming: the merchant sees an "Incoming QR payment" on their
-- dashboard that stays there until they have looked at the customer's paid screen and confirmed it (or said it was not received).
--   PENDING   the customer chose QR and says they paid; the merchant has not looked yet
--   CONFIRMED the merchant confirmed it (a rental is then paid; a swap waits for the batteries to be handed over)
--   USED      a confirmed swap payment that the swap has now been done with
--   CANCELLED the merchant did not receive it (or the customer chose another way)
create table dr_qr_payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references dr_shops (id),
  booking_id uuid not null references dr_bookings (id) on delete cascade,
  kind text not null check (kind in ('RENTAL_FEE', 'BATTERY_SWAP_FEE')),
  amount_myr numeric(10, 2) not null check (amount_myr >= 0),
  battery_count int check (battery_count in (1, 2)),
  status text not null default 'PENDING' check (status in ('PENDING', 'CONFIRMED', 'USED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_staff_id uuid references staff_users (id)
);
-- one open QR payment of each kind per booking
create unique index dr_qr_payments_one_open on dr_qr_payments (booking_id, kind) where status in ('PENDING', 'CONFIRMED');
create index dr_qr_payments_shop_status_idx on dr_qr_payments (shop_id, status);
alter table dr_qr_payments enable row level security;
create policy admin_all_dr_qr_payments on dr_qr_payments for all using (is_admin()) with check (is_admin());

-- a battery swap can be paid by QR too
alter table dr_battery_swaps drop constraint dr_battery_swaps_paid_by_check;
alter table dr_battery_swaps add constraint dr_battery_swaps_paid_by_check check (paid_by in ('CARD', 'CASH', 'QR'));

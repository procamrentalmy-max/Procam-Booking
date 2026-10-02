-- Walk-in bookings where the CUSTOMER types their own details.
--
-- The merchant picks a drone and a duration and shows a QR code. The
-- customer scans it on their own phone and fills in name/phone/email (a
-- public page — customers never sign in, the random public_token is the
-- only key to it). The merchant then sees those details and accepts or
-- declines; only on accept does a real booking get created (so a QR that
-- nobody scans, or a customer who walks away, leaves nothing behind in
-- dr_bookings and never blocks the drone's calendar).
--
-- A request is "expired" simply when expires_at has passed — computed on
-- read rather than stored as a status, so nothing has to run to expire it.

create type dr_walkin_status as enum ('WAITING', 'SUBMITTED', 'ACCEPTED', 'DECLINED', 'CANCELLED');

create table dr_walkin_requests (
  id uuid primary key default gen_random_uuid(),
  public_token text not null unique,
  shop_id uuid not null references dr_shops(id),
  drone_id uuid not null references dr_drones(id),
  duration_minutes int not null check (duration_minutes > 0),
  created_by_staff_id uuid not null references staff_users(id),
  status dr_walkin_status not null default 'WAITING',
  -- Filled in by the customer from the QR page.
  customer_name text,
  customer_phone text,
  customer_email text,
  submitted_at timestamptz,
  -- Set when the merchant accepts and the booking is created.
  booking_id uuid references dr_bookings(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_dr_walkin_requests_shop_status on dr_walkin_requests(shop_id, status);
create trigger trg_dr_walkin_requests_updated_at before update on dr_walkin_requests
  for each row execute function set_updated_at();

alter table dr_walkin_requests enable row level security;
create policy admin_all_dr_walkin_requests on dr_walkin_requests for all using (is_admin()) with check (is_admin());
create policy merchant_all_dr_walkin_requests on dr_walkin_requests for all using (is_drone_merchant()) with check (is_drone_merchant());

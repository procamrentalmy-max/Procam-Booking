-- Drone Rental (merchant-mediated) — a second, parallel rental vertical.
--
-- Deliberately NOT built on the locker-network tables (partners, lockers,
-- rental_assets, rental_packages, the locker-engine feasibility code). That
-- model is self-service: no staff at handover, equipment lives in lockers
-- that get physically moved between locations by a routing worker. This one
-- is the opposite shape: a human "merchant" is always present for pickup and
-- return (takes the condition photos, runs the customer through a checklist
-- in person), drones never move from the shop they're assigned to, and
-- pricing is a flat hourly rate rather than fixed duration/price tiers.
-- Reusing customers/staff_users (identity/auth is genuinely shared) but
-- everything product-specific gets its own dr_-prefixed tables so this
-- vertical's very different rules (30-minute slot grid, battery swap
-- workflow, instant walk-in bookings) can evolve without touching the
-- locker engine at all.
--
-- Same customer-auth model as 0001_init.sql: customers never hold a
-- Supabase session, every customer-facing mutation runs through a server
-- action validating a booking's secure_token and writing with the service
-- role. RLS below only ever needs to cover admin/merchant access.

-- ============================================================================
-- ENUMS
-- ============================================================================

create type dr_drone_status as enum ('AVAILABLE', 'RENTED', 'MAINTENANCE', 'LOST', 'RETIRED');
create type dr_battery_status as enum ('AT_SHOP', 'WITH_CUSTOMER', 'MAINTENANCE', 'LOST', 'RETIRED');
create type dr_booking_status as enum ('PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED');
-- ONLINE: the customer booked themselves through the map/slot-table flow.
-- MERCHANT_INSTANT: a walk-in the merchant booked on the spot (see
-- lib/droneRental/merchantBooking.ts) — its start time is always "now".
create type dr_booking_source as enum ('ONLINE', 'MERCHANT_INSTANT');
-- What the merchant found at return, driving how much of the RM100 deposit
-- gets kept: NONE releases it all, DAMAGED keeps RM50, LOST keeps the lot.
create type dr_deposit_outcome as enum ('NONE', 'DAMAGED', 'LOST');
create type dr_payment_kind as enum ('RENTAL_FEE', 'BATTERY_SWAP_FEE');
create type dr_checklist_phase as enum ('PICKUP', 'RETURN');

-- ============================================================================
-- MERCHANT ROLE HELPER
-- ============================================================================

create or replace function is_drone_merchant()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from staff_users
    where auth_user_id = auth.uid() and role = 'DRONE_MERCHANT' and active
  );
$$;

-- ============================================================================
-- SHOPS (fixed pickup locations — drones never move from where they're assigned)
-- ============================================================================

create sequence dr_shops_human_id_seq;
create sequence dr_drones_human_id_seq;
create sequence dr_batteries_human_id_seq;
create sequence dr_bookings_human_id_seq;

create table dr_shops (
  id uuid primary key default gen_random_uuid(),
  human_id text not null unique default next_human_id('dr_shops_human_id_seq', 'SHOP', 3),
  name text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  google_maps_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_dr_shops_updated_at before update on dr_shops
  for each row execute function set_updated_at();

-- Which merchant staff accounts can operate which shop(s). Not an RLS
-- boundary (see policies below — merchant access is all-or-nothing, same
-- pattern ProCam staff already uses for rental_assets/batteries); this is
-- purely so the merchant UI knows which shop(s)' bookings to default to.
create table dr_merchant_shops (
  staff_user_id uuid not null references staff_users(id) on delete cascade,
  shop_id uuid not null references dr_shops(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (staff_user_id, shop_id)
);
create index idx_dr_merchant_shops_shop on dr_merchant_shops(shop_id);

-- ============================================================================
-- DRONES & BATTERIES
-- ============================================================================

create table dr_drones (
  id uuid primary key default gen_random_uuid(),
  human_id text not null unique default next_human_id('dr_drones_human_id_seq', 'DRN', 3),
  shop_id uuid not null references dr_shops(id),
  model text not null default 'DJI Neo 2 Fly More Combo',
  serial_number text unique,
  cost_price_myr numeric(10, 2) not null default 1100 check (cost_price_myr >= 0),
  status dr_drone_status not null default 'AVAILABLE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_dr_drones_shop on dr_drones(shop_id);
create index idx_dr_drones_status on dr_drones(status);
create trigger trg_dr_drones_updated_at before update on dr_drones
  for each row execute function set_updated_at();

-- Each drone ships with exactly 3 batteries (the rule: a customer holds at
-- most 2 at a time; a swap-in of a 3rd requires returning one first — see
-- lib/droneRental/pricingRules.ts). current_booking_id is who's physically
-- holding a WITH_CUSTOMER battery right now; cleared on return.
create table dr_batteries (
  id uuid primary key default gen_random_uuid(),
  human_id text not null unique default next_human_id('dr_batteries_human_id_seq', 'DBAT', 3),
  drone_id uuid not null references dr_drones(id),
  status dr_battery_status not null default 'AT_SHOP',
  current_booking_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_dr_batteries_drone on dr_batteries(drone_id);
create index idx_dr_batteries_booking on dr_batteries(current_booking_id) where current_booking_id is not null;
create trigger trg_dr_batteries_updated_at before update on dr_batteries
  for each row execute function set_updated_at();

-- ============================================================================
-- BOOKINGS
-- ============================================================================

create table dr_bookings (
  id uuid primary key default gen_random_uuid(),
  human_id text not null unique default next_human_id('dr_bookings_human_id_seq', 'DBK', 5),
  secure_token text not null unique,

  customer_id uuid not null references customers(id),
  shop_id uuid not null references dr_shops(id),
  drone_id uuid not null references dr_drones(id),

  status dr_booking_status not null default 'PENDING_PAYMENT',

  start_time timestamptz not null,
  end_time timestamptz not null,
  actual_pickup_time timestamptz,
  actual_return_time timestamptz,

  rental_fee_myr numeric(10, 2) not null check (rental_fee_myr >= 0),
  deposit_myr numeric(10, 2) not null default 100 check (deposit_myr >= 0),
  deposit_outcome dr_deposit_outcome not null default 'NONE',
  deposit_deduction_myr numeric(10, 2) not null default 0 check (deposit_deduction_myr >= 0),

  source dr_booking_source not null default 'ONLINE',
  -- Set only for MERCHANT_INSTANT bookings — who at the shop created it.
  created_by_staff_id uuid references staff_users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (end_time > start_time)
);
create index idx_dr_bookings_customer on dr_bookings(customer_id);
create index idx_dr_bookings_shop on dr_bookings(shop_id);
create index idx_dr_bookings_drone on dr_bookings(drone_id);
create index idx_dr_bookings_status on dr_bookings(status);
create index idx_dr_bookings_secure_token on dr_bookings(secure_token);
create trigger trg_dr_bookings_updated_at before update on dr_bookings
  for each row execute function set_updated_at();

-- The real concurrency backstop (mirrors no_overlapping_asset_bookings in
-- 0001_init.sql) — a drone cannot hold two overlapping non-terminal
-- bookings, enforced by Postgres itself rather than trusted to application
-- code racing against itself.
alter table dr_bookings
  add constraint no_overlapping_drone_bookings
  exclude using gist (
    drone_id with =,
    tstzrange(start_time, end_time) with &&
  )
  where (status not in ('CANCELLED', 'EXPIRED', 'COMPLETED'));

alter table dr_batteries
  add constraint dr_batteries_current_booking_fkey
  foreign key (current_booking_id) references dr_bookings(id) on delete set null;

-- Atomic booking insert, same reasoning as create_locker_booking_atomic
-- (0012_worker_schedule_lock.sql): the exclude constraint above is the real
-- backstop against two concurrent callers both thinking the same drone/slot
-- is free, but wrapping the insert in a function keeps that race window as
-- small as a single statement instead of spanning the caller's whole
-- app-side feasibility check.
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
  p_created_by_staff_id uuid default null
)
returns dr_bookings
language plpgsql
set search_path = public
as $$
declare
  v_booking dr_bookings;
begin
  -- Always PENDING_PAYMENT regardless of source, including MERCHANT_INSTANT:
  -- a walk-in still pays and gets its deposit hold placed through the exact
  -- same Stripe flow an online booking does (see
  -- lib/droneRental/payment.ts::confirmDroneBookingAfterPayment) — the
  -- customer just does it on the merchant's device instead of their own.
  -- That's what actually gets a real automated deposit hold on a walk-in's
  -- card instead of leaving it to be collected by hand.
  insert into dr_bookings (
    customer_id, shop_id, drone_id, start_time, end_time,
    rental_fee_myr, deposit_myr, secure_token, source, created_by_staff_id,
    status
  ) values (
    p_customer_id, p_shop_id, p_drone_id, p_start_time, p_end_time,
    p_rental_fee_myr, p_deposit_myr, p_secure_token, p_source, p_created_by_staff_id,
    'PENDING_PAYMENT'
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

-- ============================================================================
-- BATTERY SWAPS (audit trail of every battery handed to/taken from a customer)
-- ============================================================================

-- One row per physical battery movement across a booking's lifetime: the
-- initial 2-battery handout at pickup (released_battery_id null, fee 0) and
-- every later swap (released_battery_id set, fee RM6 — see
-- lib/droneRental/pricingRules.ts). Full history in one place rather than
-- just the current state, since "how many swaps happened" is itself part of
-- the merchant's charge record.
create table dr_battery_swaps (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references dr_bookings(id),
  released_battery_id uuid references dr_batteries(id),
  issued_battery_id uuid not null references dr_batteries(id),
  fee_myr numeric(10, 2) not null default 0 check (fee_myr >= 0),
  performed_by_staff_id uuid not null references staff_users(id),
  created_at timestamptz not null default now()
);
create index idx_dr_battery_swaps_booking on dr_battery_swaps(booking_id);

-- ============================================================================
-- MERCHANT CHECKLIST & CONDITION PHOTOS (merchant-taken, not customer-taken)
-- ============================================================================

-- Admin-editable checklist items the merchant runs through with the customer
-- at handover (spec: "sign a checklist and show the customers how everything
-- works") — one flat list since this vertical is a single product, unlike
-- ProCam's per-product check_templates.
create table dr_checklist_items (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  label text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table dr_checklist_records (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references dr_bookings(id),
  phase dr_checklist_phase not null,
  -- {item_key: true/false}, same jsonb-checklist shape ProCam already uses
  -- (condition_checks.acknowledgements).
  acknowledgements jsonb not null default '{}'::jsonb,
  customer_signed_name text,
  signed_at timestamptz,
  performed_by_staff_id uuid not null references staff_users(id),
  notes text,
  created_at timestamptz not null default now()
);
create unique index idx_dr_checklist_records_booking_phase on dr_checklist_records(booking_id, phase);

create table dr_checklist_photos (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references dr_bookings(id),
  phase dr_checklist_phase not null,
  storage_path text not null,
  taken_by_staff_id uuid not null references staff_users(id),
  created_at timestamptz not null default now()
);
create index idx_dr_checklist_photos_booking on dr_checklist_photos(booking_id, phase);

-- ============================================================================
-- PAYMENTS & DEPOSITS
-- ============================================================================

create table dr_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references dr_bookings(id),
  kind dr_payment_kind not null default 'RENTAL_FEE',
  provider text not null default 'stripe',
  provider_ref text not null,
  amount_myr numeric(10, 2) not null check (amount_myr >= 0),
  -- Reuses payment_status from 0001_init.sql — same PENDING/SUCCEEDED/
  -- FAILED/REFUNDED lifecycle, no reason for a second copy of that enum.
  status payment_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_dr_payments_booking on dr_payments(booking_id);
create unique index idx_dr_payments_provider_ref on dr_payments(provider, provider_ref);
create trigger trg_dr_payments_updated_at before update on dr_payments
  for each row execute function set_updated_at();

create table dr_deposit_authorizations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references dr_bookings(id),
  provider text not null default 'stripe',
  provider_ref text not null,
  amount_myr numeric(10, 2) not null check (amount_myr >= 0),
  -- Reuses deposit_status from 0001_init.sql (AUTHORIZED/RELEASED/CAPTURED/
  -- PARTIALLY_CAPTURED/VOIDED/EXPIRED) — fits this vertical's deposit
  -- lifecycle exactly.
  status deposit_status not null default 'AUTHORIZED',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references staff_users(id)
);
create index idx_dr_deposit_auth_booking on dr_deposit_authorizations(booking_id);
create unique index idx_dr_deposit_auth_provider_ref on dr_deposit_authorizations(provider, provider_ref);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table dr_shops enable row level security;
alter table dr_merchant_shops enable row level security;
alter table dr_drones enable row level security;
alter table dr_batteries enable row level security;
alter table dr_bookings enable row level security;
alter table dr_battery_swaps enable row level security;
alter table dr_checklist_items enable row level security;
alter table dr_checklist_records enable row level security;
alter table dr_checklist_photos enable row level security;
alter table dr_payments enable row level security;
alter table dr_deposit_authorizations enable row level security;

-- Admin: full access to everything, same as every other ProCam table.
create policy admin_all_dr_shops on dr_shops for all using (is_admin()) with check (is_admin());
create policy admin_all_dr_merchant_shops on dr_merchant_shops for all using (is_admin()) with check (is_admin());
create policy admin_all_dr_drones on dr_drones for all using (is_admin()) with check (is_admin());
create policy admin_all_dr_batteries on dr_batteries for all using (is_admin()) with check (is_admin());
create policy admin_all_dr_bookings on dr_bookings for all using (is_admin()) with check (is_admin());
create policy admin_all_dr_battery_swaps on dr_battery_swaps for all using (is_admin()) with check (is_admin());
create policy admin_all_dr_checklist_items on dr_checklist_items for all using (is_admin()) with check (is_admin());
create policy admin_all_dr_checklist_records on dr_checklist_records for all using (is_admin()) with check (is_admin());
create policy admin_all_dr_checklist_photos on dr_checklist_photos for all using (is_admin()) with check (is_admin());
create policy admin_all_dr_payments on dr_payments for all using (is_admin()) with check (is_admin());
create policy admin_all_dr_deposit_authorizations on dr_deposit_authorizations for all using (is_admin()) with check (is_admin());

-- Merchant: broad read/write on the operational tables their job actually
-- touches (same "no per-location RLS, scoping is a UI concern" pattern
-- ProCam staff already uses for rental_assets/batteries — see
-- dr_merchant_shops for the UI-level scoping). Money tables (payments,
-- deposit authorizations) are admin-only to read directly, same as ProCam:
-- merchant-triggered captures/releases go through a service-role server
-- action, not direct table access.
create policy merchant_read_dr_shops on dr_shops for select using (is_drone_merchant());
create policy merchant_read_own_dr_merchant_shops on dr_merchant_shops for select
  using (is_drone_merchant() and staff_user_id = (select id from staff_users where auth_user_id = auth.uid()));
create policy merchant_all_dr_drones on dr_drones for all using (is_drone_merchant()) with check (is_drone_merchant());
create policy merchant_all_dr_batteries on dr_batteries for all using (is_drone_merchant()) with check (is_drone_merchant());
create policy merchant_all_dr_bookings on dr_bookings for all using (is_drone_merchant()) with check (is_drone_merchant());
create policy merchant_all_dr_battery_swaps on dr_battery_swaps for all using (is_drone_merchant()) with check (is_drone_merchant());
create policy merchant_read_dr_checklist_items on dr_checklist_items for select using (is_drone_merchant());
create policy merchant_all_dr_checklist_records on dr_checklist_records for all using (is_drone_merchant()) with check (is_drone_merchant());
create policy merchant_all_dr_checklist_photos on dr_checklist_photos for all using (is_drone_merchant()) with check (is_drone_merchant());

-- ============================================================================
-- DEFAULT CHECKLIST (admin can add/retire items later from /admin — a basic
-- CRUD page for this table is a follow-up, not built yet)
-- ============================================================================

insert into dr_checklist_items (item_key, label, sort_order) values
  ('powers_on', 'Drone powers on and connects to the controller', 1),
  ('propellers_intact', 'All 4 propellers/prop guards are undamaged', 2),
  ('body_undamaged', 'Body and gimbal/camera show no visible damage', 3),
  ('batteries_present', 'Batteries handed over are charged and seated correctly', 4),
  ('accessories_present', 'Case, controller, and charging cable are present', 5);

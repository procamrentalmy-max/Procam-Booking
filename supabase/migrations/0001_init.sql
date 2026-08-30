-- ProCam V1 — initial schema
-- See docs: C:\Users\user\Claude Code\.claude\plans\harmonic-sauteeing-kurzweil.md
--
-- Design notes:
--   * Customers never authenticate to Supabase directly. Every customer-facing
--     mutation goes through a server route handler that validates a booking's
--     secure_token, then writes using the service role (which bypasses RLS).
--     Because of this, there are NO anon/public RLS policies below.
--   * Staff/reception authenticate via Supabase Auth. RLS is the real
--     enforcement boundary for what they can read/write directly.
--   * Reception RLS is READ-ONLY. All reception mutations (handover, return
--     receipt, battery exchange) go through server actions that re-validate
--     the state machine before writing with the service role. This is what
--     makes "reception cannot approve damage / release deposits" a fact about
--     the system, not just a hidden button.
--   * asset_events and audit_logs are append-only: no UPDATE/DELETE policy
--     exists for any role, including admin, so history cannot be edited.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ============================================================================
-- ENUMS
-- ============================================================================

create type partner_status as enum ('ACTIVE', 'INACTIVE');
create type staff_role as enum ('PROCAM_STAFF', 'ADMIN');

create type identity_verification_method as enum ('WHATSAPP_OTP', 'SMS_OTP');
create type identity_verification_status as enum ('PENDING', 'VERIFIED', 'FAILED');

create type camera_status as enum (
  'AVAILABLE', 'RESERVED', 'READY_FOR_PICKUP', 'RENTED',
  'RETURNED_AWAITING_INSPECTION', 'INSPECTION', 'CLEANING', 'CHARGING',
  'MAINTENANCE', 'LOST', 'RETIRED'
);

create type kit_status as enum (
  'AVAILABLE', 'WITH_CUSTOMER', 'AWAITING_INSPECTION', 'MAINTENANCE', 'RETIRED'
);

create type battery_status as enum (
  'CHARGED', 'DEPLOYED', 'CHARGING', 'MAINTENANCE', 'LOST', 'RETIRED'
);

create type booking_status as enum (
  'PENDING_PAYMENT', 'CONFIRMED', 'READY_FOR_PICKUP', 'ACTIVE',
  'RETURN_STARTED', 'AWAITING_INSPECTION', 'INSPECTION', 'DAMAGE_REVIEW',
  'COMPLETED', 'CANCELLED', 'EXPIRED'
);

create type payment_kind as enum ('RENTAL_FEE');
create type payment_status as enum ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

create type deposit_status as enum (
  'AUTHORIZED', 'RELEASED', 'CAPTURED', 'PARTIALLY_CAPTURED', 'VOIDED', 'EXPIRED'
);

create type condition_check_type as enum ('PRE_RENTAL', 'RETURN');
create type condition_photo_type as enum ('SCREEN_ON', 'LENS_A', 'LENS_B', 'KIT_FULL');

create type inspection_result as enum ('PASS', 'DAMAGE');

create type damage_category as enum (
  'LENS_SCRATCH', 'SEVERE_LENS_DAMAGE', 'SCREEN_DAMAGE', 'BODY_DAMAGE',
  'WATER_DAMAGE', 'MISSING_ACCESSORY', 'MISSING_BATTERY', 'CAMERA_MISSING',
  'FUNCTIONALITY_ISSUE', 'OTHER'
);
create type damage_case_status as enum ('OPEN', 'UNDER_REVIEW', 'RESOLVED');
create type deposit_action as enum ('NONE', 'CAPTURED', 'PARTIALLY_CAPTURED');

create type maintainable_asset_type as enum ('CAMERA', 'BATTERY');
create type tracked_asset_type as enum ('CAMERA', 'BATTERY', 'KIT');

create type actor_type as enum ('CUSTOMER', 'RECEPTION', 'STAFF', 'ADMIN', 'SYSTEM');

create type notification_channel as enum ('EMAIL', 'WHATSAPP', 'SMS');
create type notification_status as enum ('PENDING', 'SENT', 'FAILED');

create type booking_source as enum ('PARTNER_QR', 'WALK_IN', 'AFFILIATE', 'OTHER');

create type commission_status as enum ('ACCRUED', 'PAID');

-- ============================================================================
-- HELPERS: human-readable asset IDs (CAM-001, BKG-00001, ...)
-- ============================================================================

create or replace function next_human_id(seq_name text, prefix text, pad int)
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  execute format('select nextval(%L)', seq_name) into n;
  return prefix || '-' || lpad(n::text, pad, '0');
end;
$$;

create sequence partners_human_id_seq;
create sequence customers_human_id_seq;
create sequence cameras_human_id_seq;
create sequence kits_human_id_seq;
create sequence batteries_human_id_seq;
create sequence bookings_human_id_seq;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- PARTNERS / STAFF / CUSTOMERS
-- ============================================================================

create table partners (
  id uuid primary key default gen_random_uuid(),
  human_id text not null unique default next_human_id('partners_human_id_seq', 'PTR', 3),
  name text not null,
  address text not null,
  commission_rate numeric(5, 4) not null default 0.20 check (commission_rate >= 0 and commission_rate <= 1),
  referral_code text not null unique,
  status partner_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_partners_updated_at before update on partners
  for each row execute function set_updated_at();

-- Reception accounts. One row per Supabase Auth user, scoped to one partner.
create table partner_users (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_partner_users_partner on partner_users(partner_id);

-- ProCam field staff / admin accounts.
create table staff_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  role staff_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  human_id text not null unique default next_human_id('customers_human_id_seq', 'CUS', 5),
  name text not null,
  phone text not null,
  email text not null,
  stripe_customer_id text unique,
  created_at timestamptz not null default now()
);
create index idx_customers_phone on customers(phone);
create index idx_customers_email on customers(email);

create table identity_verifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  method identity_verification_method not null,
  otp_code_hash text,
  otp_expires_at timestamptz,
  otp_attempts int not null default 0,
  id_document_photo_path text,
  otp_verified_at timestamptz,
  status identity_verification_status not null default 'PENDING',
  created_at timestamptz not null default now()
);
create index idx_identity_verifications_customer on identity_verifications(customer_id);

-- ============================================================================
-- RENTAL PACKAGES (admin-configurable pricing)
-- ============================================================================

create table rental_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_minutes int not null check (duration_minutes > 0),
  price_myr numeric(10, 2) not null check (price_myr >= 0),
  deposit_myr numeric(10, 2) not null check (deposit_myr >= 0),
  late_fee_per_hour_myr numeric(10, 2) not null default 0 check (late_fee_per_hour_myr >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_rental_packages_updated_at before update on rental_packages
  for each row execute function set_updated_at();

-- ============================================================================
-- PHYSICAL ASSETS: cameras, kits, batteries
-- ============================================================================

create table cameras (
  id uuid primary key default gen_random_uuid(),
  human_id text not null unique default next_human_id('cameras_human_id_seq', 'CAM', 3),
  model text not null,
  serial_number text not null unique,
  partner_id uuid references partners(id) on delete set null,
  status camera_status not null default 'MAINTENANCE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_cameras_partner on cameras(partner_id);
create index idx_cameras_status on cameras(status);
create trigger trg_cameras_updated_at before update on cameras
  for each row execute function set_updated_at();

create table kits (
  id uuid primary key default gen_random_uuid(),
  human_id text not null unique default next_human_id('kits_human_id_seq', 'KIT', 3),
  partner_id uuid references partners(id) on delete set null,
  status kit_status not null default 'AVAILABLE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_kits_partner on kits(partner_id);
create trigger trg_kits_updated_at before update on kits
  for each row execute function set_updated_at();

-- Static contents list for a kit (selfie stick, strap, case, ...).
create table kit_items (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references kits(id) on delete cascade,
  item_name text not null
);
create index idx_kit_items_kit on kit_items(kit_id);

create table batteries (
  id uuid primary key default gen_random_uuid(),
  human_id text not null unique default next_human_id('batteries_human_id_seq', 'BAT', 3),
  partner_id uuid references partners(id) on delete set null,
  status battery_status not null default 'CHARGED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_batteries_partner on batteries(partner_id);
create trigger trg_batteries_updated_at before update on batteries
  for each row execute function set_updated_at();

-- ============================================================================
-- BOOKINGS
-- ============================================================================

create table bookings (
  id uuid primary key default gen_random_uuid(),
  human_id text not null unique default next_human_id('bookings_human_id_seq', 'BKG', 5),
  secure_token text not null unique,

  customer_id uuid not null references customers(id),
  partner_id uuid not null references partners(id),
  rental_package_id uuid not null references rental_packages(id),
  camera_id uuid not null references cameras(id),
  kit_id uuid not null references kits(id),
  battery_id uuid references batteries(id),

  status booking_status not null default 'PENDING_PAYMENT',

  start_time timestamptz not null,
  end_time timestamptz not null,
  actual_pickup_time timestamptz,
  actual_return_time timestamptz,

  source booking_source not null default 'PARTNER_QR',
  referral_code text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (end_time > start_time)
);
create index idx_bookings_customer on bookings(customer_id);
create index idx_bookings_partner on bookings(partner_id);
create index idx_bookings_camera on bookings(camera_id);
create index idx_bookings_status on bookings(status);
create index idx_bookings_secure_token on bookings(secure_token);
create trigger trg_bookings_updated_at before update on bookings
  for each row execute function set_updated_at();

-- The core correctness guarantee: a camera cannot have two overlapping
-- non-terminal bookings. Enforced by Postgres itself, not application code.
alter table bookings
  add constraint no_overlapping_camera_bookings
  exclude using gist (
    camera_id with =,
    tsrange(start_time, end_time) with &&
  )
  where (status not in ('CANCELLED', 'EXPIRED', 'COMPLETED'));

-- Same guarantee for kits — the numbered pouch is a tracked asset too
-- (spec section 8) and must not be double-booked any more than the camera.
alter table bookings
  add constraint no_overlapping_kit_bookings
  exclude using gist (
    kit_id with =,
    tsrange(start_time, end_time) with &&
  )
  where (status not in ('CANCELLED', 'EXPIRED', 'COMPLETED'));

-- ============================================================================
-- BATTERY EXCHANGES
-- ============================================================================

create table battery_exchanges (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  old_battery_id uuid not null references batteries(id),
  new_battery_id uuid not null references batteries(id),
  partner_id uuid not null references partners(id),
  performed_by_partner_user_id uuid references partner_users(id),
  created_at timestamptz not null default now()
);
create index idx_battery_exchanges_booking on battery_exchanges(booking_id);

-- ============================================================================
-- PAYMENTS & DEPOSITS
-- ============================================================================

create table payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  kind payment_kind not null default 'RENTAL_FEE',
  provider text not null default 'stripe',
  provider_ref text not null,
  amount_myr numeric(10, 2) not null check (amount_myr >= 0),
  status payment_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_payments_booking on payments(booking_id);
create unique index idx_payments_provider_ref on payments(provider, provider_ref);
create trigger trg_payments_updated_at before update on payments
  for each row execute function set_updated_at();

create table deposit_authorizations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  provider text not null default 'stripe',
  provider_ref text not null,
  amount_myr numeric(10, 2) not null check (amount_myr >= 0),
  status deposit_status not null default 'AUTHORIZED',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references staff_users(id)
);
create index idx_deposit_auth_booking on deposit_authorizations(booking_id);
create unique index idx_deposit_auth_provider_ref on deposit_authorizations(provider, provider_ref);

-- ============================================================================
-- CONDITION EVIDENCE
-- ============================================================================

create table condition_checks (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  camera_id uuid not null references cameras(id),
  type condition_check_type not null,
  performed_at timestamptz not null default now(),
  ack_powers_on boolean not null default false,
  ack_no_damage boolean not null default false,
  ack_accessories_present boolean not null default false,
  damage_reported boolean not null default false,
  damage_description text,
  created_at timestamptz not null default now()
);
create index idx_condition_checks_booking on condition_checks(booking_id);
create unique index idx_condition_checks_booking_type on condition_checks(booking_id, type);

create table condition_photos (
  id uuid primary key default gen_random_uuid(),
  condition_check_id uuid not null references condition_checks(id) on delete cascade,
  photo_type condition_photo_type not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index idx_condition_photos_check on condition_photos(condition_check_id);
create unique index idx_condition_photos_check_type on condition_photos(condition_check_id, photo_type);

-- ============================================================================
-- INSPECTION & DAMAGE
-- ============================================================================

create table inspections (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  camera_id uuid not null references cameras(id),
  inspector_staff_id uuid not null references staff_users(id),
  result inspection_result not null,
  checklist jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_inspections_booking on inspections(booking_id);
create index idx_inspections_camera on inspections(camera_id);

create table damage_cases (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references inspections(id),
  booking_id uuid not null references bookings(id),
  category damage_category not null,
  description text not null,
  status damage_case_status not null default 'OPEN',
  resolution_notes text,
  deposit_action deposit_action not null default 'NONE',
  resolved_by uuid references staff_users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_damage_cases_booking on damage_cases(booking_id);
create trigger trg_damage_cases_updated_at before update on damage_cases
  for each row execute function set_updated_at();

create table damage_case_photos (
  id uuid primary key default gen_random_uuid(),
  damage_case_id uuid not null references damage_cases(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index idx_damage_case_photos_case on damage_case_photos(damage_case_id);

-- ============================================================================
-- MAINTENANCE
-- ============================================================================

create table maintenance (
  id uuid primary key default gen_random_uuid(),
  asset_type maintainable_asset_type not null,
  camera_id uuid references cameras(id),
  battery_id uuid references batteries(id),
  description text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  staff_id uuid not null references staff_users(id),
  check (
    (asset_type = 'CAMERA' and camera_id is not null and battery_id is null) or
    (asset_type = 'BATTERY' and battery_id is not null and camera_id is null)
  )
);
create index idx_maintenance_camera on maintenance(camera_id);
create index idx_maintenance_battery on maintenance(battery_id);

-- ============================================================================
-- COMMISSIONS
-- ============================================================================

create table commissions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings(id),
  partner_id uuid not null references partners(id),
  rental_amount_myr numeric(10, 2) not null,
  rate numeric(5, 4) not null,
  commission_amount_myr numeric(10, 2) not null,
  status commission_status not null default 'ACCRUED',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_commissions_partner on commissions(partner_id);

-- ============================================================================
-- APPEND-ONLY HISTORY: asset_events, audit_logs
-- ============================================================================

create table asset_events (
  id uuid primary key default gen_random_uuid(),
  asset_type tracked_asset_type not null,
  asset_id uuid not null,
  booking_id uuid references bookings(id),
  event_type text not null,
  from_status text,
  to_status text not null,
  actor_type actor_type not null,
  actor_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_asset_events_asset on asset_events(asset_type, asset_id, created_at);
create index idx_asset_events_booking on asset_events(booking_id);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type actor_type not null,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_logs_entity on audit_logs(entity_type, entity_id, created_at);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

create table notifications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  booking_id uuid references bookings(id),
  channel notification_channel not null,
  template text not null,
  status notification_status not null default 'PENDING',
  sent_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_notifications_booking on notifications(booking_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from staff_users
    where auth_user_id = auth.uid() and role = 'ADMIN' and active
  );
$$;

create or replace function is_procam_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from staff_users
    where auth_user_id = auth.uid() and active
  );
$$;

create or replace function current_reception_partner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select partner_id from partner_users
  where auth_user_id = auth.uid() and active
  limit 1;
$$;

-- Enable RLS everywhere. No policy = no access (default deny), which is
-- exactly what we want for customers (they never hold a Supabase session).
alter table partners enable row level security;
alter table partner_users enable row level security;
alter table staff_users enable row level security;
alter table customers enable row level security;
alter table identity_verifications enable row level security;
alter table rental_packages enable row level security;
alter table cameras enable row level security;
alter table kits enable row level security;
alter table kit_items enable row level security;
alter table batteries enable row level security;
alter table bookings enable row level security;
alter table battery_exchanges enable row level security;
alter table payments enable row level security;
alter table deposit_authorizations enable row level security;
alter table condition_checks enable row level security;
alter table condition_photos enable row level security;
alter table inspections enable row level security;
alter table damage_cases enable row level security;
alter table damage_case_photos enable row level security;
alter table maintenance enable row level security;
alter table commissions enable row level security;
alter table asset_events enable row level security;
alter table audit_logs enable row level security;
alter table notifications enable row level security;

-- Admins: full access to every operational table.
create policy admin_all_partners on partners for all using (is_admin()) with check (is_admin());
create policy admin_all_partner_users on partner_users for all using (is_admin()) with check (is_admin());
create policy admin_all_staff_users on staff_users for all using (is_admin()) with check (is_admin());
create policy admin_all_customers on customers for all using (is_admin()) with check (is_admin());
create policy admin_all_identity_verifications on identity_verifications for all using (is_admin()) with check (is_admin());
create policy admin_all_rental_packages on rental_packages for all using (is_admin()) with check (is_admin());
create policy admin_all_cameras on cameras for all using (is_admin()) with check (is_admin());
create policy admin_all_kits on kits for all using (is_admin()) with check (is_admin());
create policy admin_all_kit_items on kit_items for all using (is_admin()) with check (is_admin());
create policy admin_all_batteries on batteries for all using (is_admin()) with check (is_admin());
create policy admin_all_bookings on bookings for all using (is_admin()) with check (is_admin());
create policy admin_all_battery_exchanges on battery_exchanges for all using (is_admin()) with check (is_admin());
create policy admin_all_payments on payments for all using (is_admin()) with check (is_admin());
create policy admin_all_deposit_authorizations on deposit_authorizations for all using (is_admin()) with check (is_admin());
create policy admin_all_condition_checks on condition_checks for all using (is_admin()) with check (is_admin());
create policy admin_all_condition_photos on condition_photos for all using (is_admin()) with check (is_admin());
create policy admin_all_inspections on inspections for all using (is_admin()) with check (is_admin());
create policy admin_all_damage_cases on damage_cases for all using (is_admin()) with check (is_admin());
create policy admin_all_damage_case_photos on damage_case_photos for all using (is_admin()) with check (is_admin());
create policy admin_all_maintenance on maintenance for all using (is_admin()) with check (is_admin());
create policy admin_all_commissions on commissions for all using (is_admin()) with check (is_admin());
create policy admin_read_asset_events on asset_events for select using (is_admin());
create policy admin_read_audit_logs on audit_logs for select using (is_admin());
create policy admin_all_notifications on notifications for all using (is_admin()) with check (is_admin());

-- ProCam field staff: broad read; write access limited to the asset/ops
-- tables their job actually touches. Bookings/payments/deposits are
-- read-only for staff — those mutate only via admin or server-side
-- service-role logic that enforces the state machine.
create policy staff_read_partners on partners for select using (is_procam_staff());
create policy staff_read_customers on customers for select using (is_procam_staff());
create policy staff_read_rental_packages on rental_packages for select using (is_procam_staff());
create policy staff_all_cameras on cameras for all using (is_procam_staff()) with check (is_procam_staff());
create policy staff_all_kits on kits for all using (is_procam_staff()) with check (is_procam_staff());
create policy staff_all_kit_items on kit_items for all using (is_procam_staff()) with check (is_procam_staff());
create policy staff_all_batteries on batteries for all using (is_procam_staff()) with check (is_procam_staff());
create policy staff_read_bookings on bookings for select using (is_procam_staff());
create policy staff_all_battery_exchanges on battery_exchanges for all using (is_procam_staff()) with check (is_procam_staff());
create policy staff_read_condition_checks on condition_checks for select using (is_procam_staff());
create policy staff_read_condition_photos on condition_photos for select using (is_procam_staff());
create policy staff_all_inspections on inspections for all using (is_procam_staff()) with check (is_procam_staff());
create policy staff_insert_damage_cases on damage_cases for insert with check (is_procam_staff());
create policy staff_read_damage_cases on damage_cases for select using (is_procam_staff());
create policy staff_all_damage_case_photos on damage_case_photos for all using (is_procam_staff()) with check (is_procam_staff());
create policy staff_all_maintenance on maintenance for all using (is_procam_staff()) with check (is_procam_staff());
create policy staff_read_commissions on commissions for select using (is_procam_staff());
create policy staff_insert_asset_events on asset_events for insert with check (is_procam_staff());
create policy staff_read_asset_events on asset_events for select using (is_procam_staff());
create policy staff_read_notifications on notifications for select using (is_procam_staff());

-- Reception: read-only, scoped to their own partner. No policy exists on
-- payments/deposit_authorizations/inspections/damage_cases/commissions for
-- this role, so reception has zero access to any of that — not hidden by
-- the UI, actually unreachable through the database.
create policy reception_read_own_bookings on bookings for select
  using (partner_id = current_reception_partner_id());
create policy reception_read_own_cameras on cameras for select
  using (partner_id = current_reception_partner_id());
create policy reception_read_own_kits on kits for select
  using (partner_id = current_reception_partner_id());
create policy reception_read_own_kit_items on kit_items for select
  using (exists (
    select 1 from kits where kits.id = kit_items.kit_id
    and kits.partner_id = current_reception_partner_id()
  ));
create policy reception_read_own_batteries on batteries for select
  using (partner_id = current_reception_partner_id());
create policy reception_read_own_battery_exchanges on battery_exchanges for select
  using (partner_id = current_reception_partner_id());
create policy reception_read_own_customers on customers for select
  using (exists (
    select 1 from bookings
    where bookings.customer_id = customers.id
    and bookings.partner_id = current_reception_partner_id()
  ));

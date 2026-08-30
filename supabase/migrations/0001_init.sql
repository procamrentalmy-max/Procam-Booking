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

create type asset_status as enum (
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
create type check_phase as enum ('PRE_RENTAL', 'RETURN', 'STAFF_INSPECTION');
create type check_input_type as enum ('PHOTO', 'BOOLEAN');

create type inspection_result as enum ('PASS', 'DAMAGE');

create type damage_category as enum (
  'LENS_SCRATCH', 'SEVERE_LENS_DAMAGE', 'SCREEN_DAMAGE', 'BODY_DAMAGE',
  'WATER_DAMAGE', 'MISSING_ACCESSORY', 'MISSING_BATTERY', 'CAMERA_MISSING',
  'FUNCTIONALITY_ISSUE', 'OTHER',
  -- SeaLife SportDiver Ultra specific. One combined enum rather than a
  -- per-product one — the staff inspection UI filters which categories it
  -- offers based on the booking's product.
  'HOUSING_CRACK', 'OPTICAL_WINDOW_DAMAGE', 'SEAL_ORING_FAILURE',
  'LOCKING_LATCH_DAMAGE', 'VACUUM_SYSTEM_FAULT', 'MOISTURE_LEAK_DETECTED',
  'CORROSION_SALT_DAMAGE', 'HOUSING_MISSING'
);
create type damage_case_status as enum ('OPEN', 'UNDER_REVIEW', 'RESOLVED');
create type deposit_action as enum ('NONE', 'CAPTURED', 'PARTIALLY_CAPTURED');

create type maintainable_asset_type as enum ('RENTAL_ASSET', 'BATTERY');
create type tracked_asset_type as enum ('RENTAL_ASSET', 'BATTERY', 'KIT');

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
create sequence rental_assets_human_id_seq;
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
-- RENTAL PRODUCTS (Insta360 Adventure Camera, SeaLife SportDiver Ultra, ...)
-- ============================================================================

-- The catalogue of rentable product lines. Everything product-specific
-- (packages, assets, kits, check templates, phone compatibility,
-- instructions, terms) hangs off this table by product_id — the booking,
-- payment, deposit, and inspection engines stay product-agnostic and never
-- need to know which product they're moving through.
create table rental_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  internal_name text not null,
  customer_facing_name text not null,
  tagline text,
  description text,
  -- Prefix for this product's asset human_ids, e.g. 'CAM', 'SDU'.
  asset_prefix text not null,
  uses_batteries boolean not null default false,
  requires_phone_compatibility boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_rental_products_updated_at before update on rental_products
  for each row execute function set_updated_at();

-- Admin-editable phone compatibility list for products that need one (spec:
-- "compatibility must be stored in editable data, do not hardcode it in
-- frontend components"). A phone not found here is treated as NOT
-- confirmed compatible — see lib/booking/phone-compatibility.ts — rather
-- than silently allowed, since we can only ever know about phones someone
-- has actually entered.
create table product_phone_compatibility (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references rental_products(id) on delete cascade,
  manufacturer text not null,
  model text not null,
  variant text,
  compatible boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_phone_compat_product on product_phone_compatibility(product_id);
create unique index idx_phone_compat_unique on product_phone_compatibility(
  product_id, lower(manufacturer), lower(model), coalesce(lower(variant), '')
);

-- Short customer-facing setup/usage steps shown after pickup (spec section
-- 11 for Insta360's short instructions, section 19 for SeaLife's longer
-- guided setup) — the ProCam app only ever hands the customer instructions
-- and collects evidence; it never reimplements the product's own controls.
create table product_instructions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references rental_products(id) on delete cascade,
  step_number int not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create unique index idx_product_instructions_unique on product_instructions(product_id, step_number);

-- Versioned per-product rental terms. A booking records exactly which
-- version it agreed to and when (booking_acknowledgements) — this also
-- fixes a pre-existing gap where the "I agree to terms" checkbox in the
-- booking wizard didn't persist anything at all.
create table product_terms_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references rental_products(id) on delete cascade,
  version int not null,
  body text not null,
  effective_at timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index idx_product_terms_unique on product_terms_versions(product_id, version);

create table booking_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  terms_version_id uuid not null references product_terms_versions(id),
  agreed_at timestamptz not null default now()
);
create unique index idx_booking_ack_unique on booking_acknowledgements(booking_id);

-- ============================================================================
-- RENTAL PACKAGES (admin-configurable pricing, product-specific)
-- ============================================================================

create table rental_packages (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references rental_products(id),
  name text not null,
  duration_minutes int not null check (duration_minutes > 0),
  price_myr numeric(10, 2) not null check (price_myr >= 0),
  deposit_myr numeric(10, 2) not null check (deposit_myr >= 0),
  late_fee_per_hour_myr numeric(10, 2) not null default 0 check (late_fee_per_hour_myr >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_rental_packages_product on rental_packages(product_id);
create trigger trg_rental_packages_updated_at before update on rental_packages
  for each row execute function set_updated_at();

-- ============================================================================
-- PHYSICAL ASSETS: rental_assets, kits, batteries
-- ============================================================================

create table rental_assets (
  id uuid primary key default gen_random_uuid(),
  human_id text not null unique,
  product_id uuid not null references rental_products(id),
  model text not null,
  serial_number text not null unique,
  partner_id uuid references partners(id) on delete set null,
  status asset_status not null default 'MAINTENANCE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_rental_assets_partner on rental_assets(partner_id);
create index idx_rental_assets_status on rental_assets(status);
create index idx_rental_assets_product on rental_assets(product_id);
create trigger trg_rental_assets_updated_at before update on rental_assets
  for each row execute function set_updated_at();

-- human_id needs the owning product's prefix (CAM-001 vs SDU-001), so it
-- can't be a plain column default the way other tables' human_ids are —
-- it has to look up rental_products first. One shared sequence across
-- products, so numbers don't restart per product (SDU-007 if 6 cameras
-- were added first) — an accepted simplification over per-product counters.
create or replace function set_rental_asset_human_id()
returns trigger
language plpgsql
as $$
declare
  v_prefix text;
begin
  if new.human_id is not null then
    return new;
  end if;
  select asset_prefix into v_prefix from rental_products where id = new.product_id;
  new.human_id := v_prefix || '-' || lpad(nextval('rental_assets_human_id_seq')::text, 3, '0');
  return new;
end;
$$;
create trigger trg_rental_assets_human_id before insert on rental_assets
  for each row execute function set_rental_asset_human_id();

create table kits (
  id uuid primary key default gen_random_uuid(),
  human_id text not null unique default next_human_id('kits_human_id_seq', 'KIT', 3),
  product_id uuid not null references rental_products(id),
  partner_id uuid references partners(id) on delete set null,
  status kit_status not null default 'AVAILABLE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_kits_partner on kits(partner_id);
create index idx_kits_product on kits(product_id);
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
  asset_id uuid not null references rental_assets(id),
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
create index idx_bookings_asset on bookings(asset_id);
create index idx_bookings_status on bookings(status);
create index idx_bookings_secure_token on bookings(secure_token);
create trigger trg_bookings_updated_at before update on bookings
  for each row execute function set_updated_at();

-- The core correctness guarantee: a rental asset cannot have two overlapping
-- non-terminal bookings. Enforced by Postgres itself, not application code.
alter table bookings
  add constraint no_overlapping_asset_bookings
  exclude using gist (
    asset_id with =,
    tsrange(start_time, end_time) with &&
  )
  where (status not in ('CANCELLED', 'EXPIRED', 'COMPLETED'));

-- Same guarantee for kits — the numbered pouch is a tracked asset too
-- (spec section 8) and must not be double-booked any more than the rental asset itself.
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

-- Product-specific, admin-editable evidence/checklist definitions. One
-- mechanism covers all three "what does staff/customer need to check"
-- concepts (spec: "the same concept should apply to pickup evidence,
-- return evidence, staff inspection") — an Insta360 pre-rental check asks
-- for lens photos, a SeaLife one asks for the sealing area and O-ring,
-- and the staff inspection checklist for each product is just another
-- phase of the same table. Replaces what used to be a fixed
-- condition_photo_type enum plus a hardcoded checklist array in the UI.
create table check_templates (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references rental_products(id) on delete cascade,
  phase check_phase not null,
  item_key text not null,
  label text not null,
  instruction text,
  input_type check_input_type not null,
  sort_order int not null default 0,
  required boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_check_templates_product_phase on check_templates(product_id, phase);
create unique index idx_check_templates_unique on check_templates(product_id, phase, item_key);

create table condition_checks (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  asset_id uuid not null references rental_assets(id),
  type condition_check_type not null,
  performed_at timestamptz not null default now(),
  -- {item_key: true/false} for this product/phase's BOOLEAN check_templates
  -- items — same jsonb-checklist pattern as inspections.checklist, since
  -- which acknowledgements exist is product-specific (an Insta360 pre-rental
  -- check asks "powers on"; a SeaLife one asks "O-ring inspected").
  acknowledgements jsonb not null default '{}'::jsonb,
  -- Not a template item: "did anything go wrong" is a distinct, universal
  -- return-time question regardless of product, not a per-product checklist
  -- entry, so it stays a dedicated column.
  damage_reported boolean not null default false,
  damage_description text,
  created_at timestamptz not null default now()
);
create index idx_condition_checks_booking on condition_checks(booking_id);
create unique index idx_condition_checks_booking_type on condition_checks(booking_id, type);

create table condition_photos (
  id uuid primary key default gen_random_uuid(),
  condition_check_id uuid not null references condition_checks(id) on delete cascade,
  check_template_item_id uuid not null references check_templates(id),
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index idx_condition_photos_check on condition_photos(condition_check_id);
create unique index idx_condition_photos_check_item on condition_photos(condition_check_id, check_template_item_id);

-- ============================================================================
-- INSPECTION & DAMAGE
-- ============================================================================

create table inspections (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  asset_id uuid not null references rental_assets(id),
  inspector_staff_id uuid not null references staff_users(id),
  result inspection_result not null,
  checklist jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);
create index idx_inspections_booking on inspections(booking_id);
create index idx_inspections_asset on inspections(asset_id);

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
  asset_id uuid references rental_assets(id),
  battery_id uuid references batteries(id),
  description text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  staff_id uuid not null references staff_users(id),
  check (
    (asset_type = 'RENTAL_ASSET' and asset_id is not null and battery_id is null) or
    (asset_type = 'BATTERY' and battery_id is not null and asset_id is null)
  )
);
create index idx_maintenance_asset on maintenance(asset_id);
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
alter table rental_products enable row level security;
alter table product_phone_compatibility enable row level security;
alter table check_templates enable row level security;
alter table product_instructions enable row level security;
alter table product_terms_versions enable row level security;
alter table booking_acknowledgements enable row level security;
alter table rental_packages enable row level security;
alter table rental_assets enable row level security;
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
create policy admin_all_rental_products on rental_products for all using (is_admin()) with check (is_admin());
create policy admin_all_phone_compatibility on product_phone_compatibility for all using (is_admin()) with check (is_admin());
create policy admin_all_check_templates on check_templates for all using (is_admin()) with check (is_admin());
create policy admin_all_product_instructions on product_instructions for all using (is_admin()) with check (is_admin());
create policy admin_all_product_terms_versions on product_terms_versions for all using (is_admin()) with check (is_admin());
create policy admin_read_booking_acknowledgements on booking_acknowledgements for select using (is_admin());
create policy admin_all_rental_packages on rental_packages for all using (is_admin()) with check (is_admin());
create policy admin_all_rental_assets on rental_assets for all using (is_admin()) with check (is_admin());
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
create policy staff_read_rental_products on rental_products for select using (is_procam_staff());
create policy staff_read_check_templates on check_templates for select using (is_procam_staff());
create policy staff_read_rental_packages on rental_packages for select using (is_procam_staff());
create policy staff_all_rental_assets on rental_assets for all using (is_procam_staff()) with check (is_procam_staff());
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
create policy reception_read_own_rental_assets on rental_assets for select
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

-- The one write reception is allowed: logging that they handed over or
-- received a pouch. Scoped to their own property's bookings, and they can
-- only ever log themselves as the actor — never impersonate STAFF/ADMIN or
-- write an entry for another property.
create policy reception_insert_own_asset_events on asset_events for insert
  with check (
    actor_type = 'RECEPTION'
    and exists (
      select 1 from bookings
      where bookings.id = asset_events.booking_id
      and bookings.partner_id = current_reception_partner_id()
    )
  );

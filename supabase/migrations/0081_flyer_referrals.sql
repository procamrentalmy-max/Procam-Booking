-- Flyers at other businesses: each flyer place has a QR that opens the landing page. A phone that scanned it is remembered for 7 days (a cookie on
-- the phone), and a booking or walk-in order made from that phone in that time is the flyer place's. On those bookings the profit after costs is
-- split 45% merchant, 45% ProCam and 10% to the flyer place (instead of 50 / 50). Admin keeps the places, sees what each is owed and marks payouts;
-- each place also has a private link to see its own numbers.

create table dr_referrers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  /** In the QR address: /go/<code>. Short, permanent, safe to print. */
  code text not null unique check (code ~ '^[A-Za-z0-9]{6,16}$'),
  /** The private link (/flyer/<token>) the flyer place uses to see its own numbers. */
  access_token text not null unique,
  contact text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- One row per phone per flyer: a phone that scans again within its 7 days is not counted again.
create table dr_referral_scans (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references dr_referrers (id) on delete cascade,
  visitor_id text not null check (visitor_id ~ '^[A-Za-z0-9-]{16,64}$'),
  created_at timestamptz not null default now(),
  unique (referrer_id, visitor_id)
);
create index dr_referral_scans_created_idx on dr_referral_scans (referrer_id, created_at);

-- What has been paid out to a flyer place (admin pays by bank transfer and records it here).
create table dr_referral_payouts (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references dr_referrers (id) on delete cascade,
  amount_myr numeric(10, 2) not null check (amount_myr > 0),
  note text,
  paid_at timestamptz not null default now()
);
create index dr_referral_payouts_referrer_idx on dr_referral_payouts (referrer_id, paid_at);

alter table dr_bookings add column referrer_id uuid references dr_referrers (id) on delete set null;
alter table dr_walkin_requests add column referrer_id uuid references dr_referrers (id) on delete set null;
create index dr_bookings_referrer_idx on dr_bookings (referrer_id) where referrer_id is not null;

alter table dr_referrers enable row level security;
alter table dr_referral_scans enable row level security;
alter table dr_referral_payouts enable row level security;
create policy admin_all_dr_referrers on dr_referrers for all using (is_admin()) with check (is_admin());
create policy admin_all_dr_referral_scans on dr_referral_scans for all using (is_admin()) with check (is_admin());
create policy admin_all_dr_referral_payouts on dr_referral_payouts for all using (is_admin()) with check (is_admin());

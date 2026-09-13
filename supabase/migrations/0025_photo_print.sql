-- Photo printing: a distinct service from camera rental (no pickup,
-- dropoff, or deposit), so it gets its own tables rather than reusing
-- bookings/rental_packages.
--
-- Each hotel opts in or out of offering complimentary 3R prints to its own
-- guests (photo_print_complimentary) -- when opted in, 3R orders are billed
-- to the hotel at the wholesale rate instead of to the guest at retail.
-- 4R is always guest-billed for now: no wholesale 4R rate has been set.
alter table partners add column photo_print_complimentary boolean not null default false;

create table photo_orders (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id),
  secure_token text not null unique,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  size text not null check (size in ('3R', '4R')),
  quantity integer not null check (quantity in (5, 10)),
  billed_to text not null check (billed_to in ('GUEST', 'HOTEL')),
  unit_price_myr numeric(10, 2) not null check (unit_price_myr >= 0),
  total_price_myr numeric(10, 2) not null check (total_price_myr >= 0),
  stripe_payment_intent_id text,
  -- HOTEL-billed orders skip payment entirely and start at SUBMITTED;
  -- GUEST-billed orders start PENDING_PAYMENT until the Stripe charge
  -- succeeds (see app/api/webhooks/stripe/route.ts).
  status text not null default 'PENDING_PAYMENT'
    check (status in ('PENDING_PAYMENT', 'SUBMITTED', 'PRINTING', 'DELIVERED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index photo_orders_secure_token_idx on photo_orders(secure_token);
create index photo_orders_partner_id_idx on photo_orders(partner_id);
create unique index photo_orders_stripe_pi_idx on photo_orders(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create trigger trg_photo_orders_updated_at before update on photo_orders
  for each row execute function set_updated_at();

create table photo_order_files (
  id uuid primary key default gen_random_uuid(),
  photo_order_id uuid not null references photo_orders(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index photo_order_files_order_id_idx on photo_order_files(photo_order_id);

alter table photo_orders enable row level security;
alter table photo_order_files enable row level security;
create policy admin_read_photo_orders on photo_orders for select using (is_admin());
create policy admin_read_photo_order_files on photo_order_files for select using (is_admin());

-- Private bucket for the customer's uploaded originals -- same access
-- pattern as condition-photos (0004_storage.sql): every upload/read goes
-- through server code using the service-role client, never a direct
-- customer or public URL.
insert into storage.buckets (id, name, public)
values ('photo-print-uploads', 'photo-print-uploads', false)
on conflict (id) do nothing;

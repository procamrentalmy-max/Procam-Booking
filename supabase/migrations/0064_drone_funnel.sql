-- Where customers drop off between the home page and paying, for the drone booking flow. Each visit gets a random id that lives only in the
-- browser tab (nothing that identifies a person), and one row is kept per visit per step reached, so the admin can see how many visits got
-- to each step and which step they left at. Written by the website with the service role; only the admin can read it.

create table dr_funnel_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null check (session_id ~ '^[A-Za-z0-9-]{16,64}$'),
  step text not null check (step in ('HOME', 'PRICE', 'SHOPS', 'PACKAGE', 'TIME', 'DETAILS', 'ID_CHECK', 'PAY', 'PAID')),
  shop_id uuid references dr_shops (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (session_id, step)
);

create index dr_funnel_events_created_idx on dr_funnel_events (created_at);

alter table dr_funnel_events enable row level security;
create policy admin_all_dr_funnel_events on dr_funnel_events for all using (is_admin()) with check (is_admin());

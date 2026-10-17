-- Which locations customers tap on the shop list, open (Check Rates or Book here) and ask directions for, one row each, to see the most clicked locations (Admin > Drone Rental > Locations).
create table dr_location_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  shop_id uuid not null references dr_shops (id) on delete cascade,
  kind text not null check (kind in ('SELECT', 'OPEN', 'DIRECTIONS')),
  bookable boolean not null,
  created_at timestamptz not null default now()
);
create index dr_location_events_shop_idx on dr_location_events (shop_id, kind);
create index dr_location_events_created_idx on dr_location_events (created_at);
alter table dr_location_events enable row level security;
create policy admin_all_dr_location_events on dr_location_events for all using (is_admin()) with check (is_admin());

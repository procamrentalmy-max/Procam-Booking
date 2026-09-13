-- Capacity-planning signal: every time real demand couldn't be met, record
-- it here so the admin capacity page can answer "where do I need to add a
-- camera / more photo slots / a new location" from actual events instead of
-- guesswork. Same anonymous, counts-only shape as funnel_events — no
-- customer identifier, just what happened, where, and when. Written
-- exclusively by the service-role client from server-side code that already
-- knows demand went unmet (lib/booking/createLockerBooking.ts,
-- lib/photoPrint/printQueue.ts), so RLS only needs to gate reads.
create table demand_signals (
  id uuid primary key default gen_random_uuid(),
  signal_type text not null check (signal_type in (
    'BOOKING_REJECTED_NO_CAMERA',
    'PHOTO_SLOTS_FULL'
  )),
  partner_id uuid references partners(id) on delete set null,
  created_at timestamptz not null default now()
);

create index demand_signals_type_created_at_idx on demand_signals (signal_type, created_at);
create index demand_signals_partner_id_idx on demand_signals (partner_id);

alter table demand_signals enable row level security;

create policy admin_read_demand_signals on demand_signals for select using (is_admin());

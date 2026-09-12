-- Anonymous booking-funnel tracking: counts only, no device/customer
-- identifier at all — just "how many times did each stage happen, at which
-- locker, when." Written exclusively by the service-role client from
-- server-rendered pages/actions, so RLS only needs to gate reads.
create table funnel_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'LANDING_VIEWED',
    'WIZARD_OPENED',
    'OTP_REQUESTED',
    'OTP_VERIFIED',
    'BOOKING_CREATED',
    'PAYMENT_CONFIRMED'
  )),
  partner_id uuid references partners(id) on delete set null,
  created_at timestamptz not null default now()
);

create index funnel_events_type_created_at_idx on funnel_events (event_type, created_at);
create index funnel_events_partner_id_idx on funnel_events (partner_id);

alter table funnel_events enable row level security;

create policy admin_read_funnel_events on funnel_events for select using (is_admin());

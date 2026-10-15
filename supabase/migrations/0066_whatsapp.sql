-- WhatsApp Business messages about a booking (confirmed, reminders, battery swap how-to, deposit nudge, cancelled). A customer only gets them if
-- they tick "WhatsApp me about my booking" when booking (whatsapp_opt_in), in the language they were using (locale). One row per message kind per
-- booking (the unique index stops a message being sent twice); the row also keeps what WhatsApp said about it (sent, delivered, read, failed).
-- Only the website (service role) writes here; only the admin can read it.

alter table dr_bookings add column whatsapp_opt_in boolean not null default false;
alter table dr_bookings add column locale text check (locale in ('en', 'ms', 'zh'));

-- A walk-in order is a request first; the booking is made when the staff confirm it, so the choice is kept on the request until then.
alter table dr_walkin_requests add column whatsapp_opt_in boolean not null default false;
alter table dr_walkin_requests add column locale text check (locale in ('en', 'ms', 'zh'));

create table wa_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references dr_bookings (id) on delete cascade,
  kind text not null check (kind in ('BOOKING_CONFIRMED', 'PICKUP_REMINDER', 'HANDOVER_DONE', 'RETURN_REMINDER', 'LATE_NOTICE', 'DEPOSIT_CONFIRM', 'BOOKING_CANCELLED')),
  to_phone text not null,
  locale text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'DRY_RUN')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, kind)
);

create index wa_messages_provider_idx on wa_messages (provider_message_id);
create index wa_messages_created_idx on wa_messages (created_at desc);

alter table wa_messages enable row level security;
create policy admin_all_wa_messages on wa_messages for all using (is_admin()) with check (is_admin());

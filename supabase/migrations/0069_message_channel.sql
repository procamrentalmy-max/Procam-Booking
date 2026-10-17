-- Booking messages go to the customer's WhatsApp number when they give one, and by SMS to their phone number when they don't.
alter table dr_bookings add column whatsapp_number text;
alter table dr_walkin_requests add column whatsapp_number text;
alter table wa_messages add column channel text not null default 'WHATSAPP' check (channel in ('WHATSAPP', 'SMS'));

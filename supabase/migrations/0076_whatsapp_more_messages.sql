-- More messages about a booking: payment received for a walk-in, a battery swap done (can happen more than once on a rental), the return with the
-- deposit hold released, the return that needs checking, and what was kept from the deposit after a check. A message of the same kind can now
-- repeat on one booking when it has a different `ref` (each battery swap), and is still sent only once when it has none.
alter table wa_messages drop constraint wa_messages_kind_check;
alter table wa_messages
  add constraint wa_messages_kind_check check (kind in (
    'BOOKING_CONFIRMED', 'PICKUP_REMINDER', 'HANDOVER_DONE', 'RETURN_REMINDER', 'LATE_NOTICE', 'DEPOSIT_CONFIRM', 'BOOKING_CANCELLED',
    'WALKIN_PAID', 'SWAP_DONE', 'RETURN_DONE', 'RETURN_REVIEW', 'DEPOSIT_DECIDED'
  ));
alter table wa_messages add column ref text;
alter table wa_messages drop constraint wa_messages_booking_id_kind_key;
create unique index wa_messages_once on wa_messages (booking_id, kind, coalesce(ref, ''));

-- New funnel stage between BOOKING_CREATED and PAYMENT_CONFIRMED for the
-- deposit-hold disclosure page (app/r/[token]/deposit-notice) — lets the
-- admin funnel dashboard show drop-off at that specific step.
alter table funnel_events drop constraint funnel_events_event_type_check;
alter table funnel_events add constraint funnel_events_event_type_check check (event_type in (
  'LANDING_VIEWED',
  'WIZARD_OPENED',
  'VERIFICATION_STARTED',
  'VERIFICATION_VERIFIED',
  'BOOKING_CREATED',
  'DEPOSIT_NOTICE_VIEWED',
  'DEPOSIT_NOTICE_ACKNOWLEDGED',
  'PAYMENT_CONFIRMED'
));

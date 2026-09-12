-- Switch identity verification from WhatsApp OTP (blocked on Meta Business
-- Verification, unresolved) to Didit KYC (ID document + liveness + face
-- match). The session id is stored so the server can independently confirm
-- the decision with Didit's own API before a booking is allowed to proceed.
alter type identity_verification_method add value 'DIDIT_KYC';
alter table identity_verifications add column didit_session_id text;
alter table identity_verifications rename column otp_verified_at to verified_at;

-- The funnel event names were coined for the OTP flow before any real
-- traffic existed against them — renamed now to describe either
-- verification method generically, rather than leaving stale "OTP" naming
-- behind now that Didit does the actual verifying.
alter table funnel_events drop constraint funnel_events_event_type_check;
alter table funnel_events add constraint funnel_events_event_type_check check (event_type in (
  'LANDING_VIEWED',
  'WIZARD_OPENED',
  'VERIFICATION_STARTED',
  'VERIFICATION_VERIFIED',
  'BOOKING_CREATED',
  'PAYMENT_CONFIRMED'
));

-- Two schema changes needed to wire real locker bookings:
--
-- 1. bookings.kit_id was NOT NULL, but kits are a reception-era concept
--    (a numbered handover pouch) the self-service locker model has no use
--    for — a locker booking is just a camera. Safe to relax: the
--    no_overlapping_kit_bookings EXCLUDE constraint is unaffected, since
--    two NULL kit_id rows never collide under `=`.
-- 2. rental_packages.is_overnight distinguishes the fixed 10pm-8am nightly
--    package (checked via bookingGate.ts's checkOvernightBookingFeasibility,
--    which skips the worker-schedule check) from ordinary hourly-slot
--    daytime packages (checkLockerBookingFeasibility) — needed a real flag
--    rather than inferring it from duration_minutes or name.

alter table bookings alter column kit_id drop not null;

alter table rental_packages add column if not exists is_overnight boolean not null default false;

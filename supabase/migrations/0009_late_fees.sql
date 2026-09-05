-- Late fees: rental_packages.late_fee_per_hour_myr already existed but was
-- never wired up. Adds the payment kind used to record a captured late fee,
-- and a column to hold the fixed, computed-at-return-time fee amount.

alter type payment_kind add value 'LATE_FEE';

alter table bookings
  add column late_fee_myr numeric(10, 2) not null default 0 check (late_fee_myr >= 0);

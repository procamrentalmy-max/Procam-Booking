-- A drone booking needs a fresh ID check (Didit) that has not been used for another booking. When a booking (or a walk-in order)
-- is made, the verification it relied on is marked used, so one ID check can't be reused for several rentals.
alter table identity_verifications add column used_at timestamptz;

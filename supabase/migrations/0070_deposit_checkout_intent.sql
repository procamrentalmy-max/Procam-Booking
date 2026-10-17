-- The card form of a booking now asks for the deposit hold first (the rental fee is charged only once the hold is in place), so the booking remembers
-- which hold it is asking for.
alter table dr_bookings add column deposit_checkout_intent text;

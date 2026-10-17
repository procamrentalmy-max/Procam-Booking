-- Only one run at a time finishes a card booking (the customer returning to the site and Stripe's message arrive together), so a repeat can never refund a booking that has just gone through.
alter table dr_bookings add column card_finish_started_at timestamptz;

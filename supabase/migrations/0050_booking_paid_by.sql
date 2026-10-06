-- How a booking was paid: by card through Stripe (the default, and everything so far), or in cash at the shop when the
-- merchant took it. A cash booking has no card hold and no saved card, so its swap and late fees are taken in cash too.
-- It matters for the merchant's earnings: the payment-processing share of the costs does not apply to cash.

alter table dr_bookings add column paid_by text not null default 'CARD' check (paid_by in ('CARD', 'CASH'));

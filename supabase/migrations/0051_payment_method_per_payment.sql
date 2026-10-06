-- Each payment on a booking is cash or card independently: the rental fee (dr_bookings.paid_by, 0050), each battery
-- swap (dr_battery_swaps.paid_by), and each late fee (dr_payments.provider is 'cash' or 'stripe').
--
-- A customer who pays the rental fee in cash still enters their card at the payment page, so the deposit can be held
-- on it and a later swap or late fee can be charged to it. That card is not tied to a rental-fee card payment in that
-- case, so its Stripe payment method is kept on the booking.

alter table dr_bookings add column stripe_payment_method_id text;
alter table dr_battery_swaps add column paid_by text not null default 'CARD' check (paid_by in ('CARD', 'CASH'));

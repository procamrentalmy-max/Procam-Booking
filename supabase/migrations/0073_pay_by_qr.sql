-- A walk-in customer can also pay the rental fee by scanning a QR (Admin > Branding > Payment QR picture). Like cash, it is chosen at
-- the payment page after the card is saved for the deposit hold; the merchant confirms once the customer shows their banking app's paid screen.

alter table site_settings add column pay_qr_path text;

alter table dr_bookings drop constraint dr_bookings_paid_by_check;
alter table dr_bookings add constraint dr_bookings_paid_by_check check (paid_by in ('CARD', 'CASH', 'QR'));

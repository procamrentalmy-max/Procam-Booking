-- Numbered pickup slots at each hotel (1-50): when a worker delivers a
-- printed order, it's assigned the highest currently-free slot number for
-- that partner, counting down from 50 -- see lib/photoPrint/slots.ts. A
-- slot stays occupied (status DELIVERED) until the housekeeping cron
-- expires it past destroy_by, at which point it's free to reassign again.
alter table photo_orders add column slot_number integer;
alter table photo_orders add column placed_at timestamptz;
alter table photo_orders add column collect_by timestamptz;
alter table photo_orders add column destroy_by timestamptz;

alter table photo_orders drop constraint photo_orders_status_check;
alter table photo_orders add constraint photo_orders_status_check check (status in (
  'PENDING_PAYMENT', 'SUBMITTED', 'PRINTING', 'DELIVERED', 'EXPIRED', 'CANCELLED'
));

-- 3R prints are discontinued entirely — 4R (7pcs/10pcs) is now the only
-- size offered. No historical order ever used 3R, so this narrows the
-- constraints outright rather than leaving a dead option around.
alter table photo_orders drop constraint photo_orders_size_check;
alter table photo_orders add constraint photo_orders_size_check check (size = '4R');

alter table photo_orders drop constraint photo_orders_size_quantity_check;
alter table photo_orders drop constraint photo_orders_quantity_check;
alter table photo_orders add constraint photo_orders_quantity_check check (quantity in (7, 10));

-- 4R print orders move from a 5/10-pack to a 7/10-pack (5 discontinued for
-- 4R, replaced by 7 at a flat RM6.50), while 3R keeps its existing 5/10
-- packs unchanged. Quantities are now size-dependent rather than one
-- shared list, so this adds a real DB-level guarantee (not just app-side
-- validation) that a row can never combine a size with a quantity that was
-- never actually offered for it.
alter table photo_orders drop constraint photo_orders_quantity_check;
alter table photo_orders add constraint photo_orders_quantity_check check (quantity in (5, 7, 10));
alter table photo_orders add constraint photo_orders_size_quantity_check check (
  (size = '3R' and quantity in (5, 10)) or
  (size = '4R' and quantity in (7, 10))
);

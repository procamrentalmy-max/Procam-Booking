-- Battery names become B1, B2, B3, ... numbered separately for each shop (every shop's batteries start at B1), so a
-- merchant works with short names that only mean something inside their own shop. The admin can still rename any
-- battery. Names must be unique within a shop (not across all shops).
--
-- A battery's shop is its drone's shop. It's stored on the battery too so the per-shop uniqueness is a real
-- database rule, and filled in automatically from the drone so nothing that inserts a battery has to pass it.

alter table dr_batteries add column shop_id uuid references dr_shops(id);

update dr_batteries b set shop_id = d.shop_id from dr_drones d where d.id = b.drone_id;

create or replace function dr_batteries_set_shop() returns trigger
language plpgsql
set search_path = public
as $$
begin
  select shop_id into new.shop_id from dr_drones where id = new.drone_id;
  return new;
end;
$$;

create trigger trg_dr_batteries_set_shop
  before insert or update of drone_id on dr_batteries
  for each row execute function dr_batteries_set_shop();

alter table dr_batteries alter column shop_id set not null;

-- Old global name rule out, then rename everything per shop: B1, B2, ... in the order the batteries were created.
drop index if exists uq_dr_batteries_name;

update dr_batteries b
set name = 'B' || n.rn
from (select id, row_number() over (partition by shop_id order by human_id) as rn from dr_batteries) n
where n.id = b.id;

create unique index uq_dr_batteries_shop_name on dr_batteries (shop_id, lower(name)) where name is not null;

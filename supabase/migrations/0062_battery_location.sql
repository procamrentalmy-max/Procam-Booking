-- A customer can swap a battery at ANY shop, not only the one they rented from. A battery belongs to one shop for good (dr_batteries.shop_id:
-- its sticker name, B1, B2..., is numbered per shop, and each shop's own battery count never changes). Where it physically is right now is
-- new: dr_batteries.at_shop_id. They differ while a battery is "away": the customer's used battery left at the swap shop, or a swap shop's
-- battery that the customer brings back to the shop they rented from. Staff carry those back and tap "Back home", which sets at_shop_id
-- back to shop_id. While a battery is with a customer, at_shop_id is where it was last at the shop.
--
-- dr_battery_swaps.swap_shop_id is the shop that did the swap (and so earns the swap fee).

alter table dr_batteries add column at_shop_id uuid references dr_shops (id);
update dr_batteries set at_shop_id = shop_id;
alter table dr_batteries alter column at_shop_id set not null;

-- Named so it fires after trg_dr_batteries_set_shop (triggers run in name order), which is what fills in shop_id.
create or replace function dr_batteries_default_location() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.at_shop_id is null then
    new.at_shop_id := new.shop_id;
  end if;
  return new;
end;
$$;

create trigger trg_dr_batteries_set_shop_location before insert on dr_batteries
  for each row execute function dr_batteries_default_location();

revoke all on function dr_batteries_default_location() from anon, authenticated, public;

create index dr_batteries_location_idx on dr_batteries (at_shop_id, status);

alter table dr_battery_swaps add column swap_shop_id uuid references dr_shops (id);
update dr_battery_swaps s set swap_shop_id = b.shop_id from dr_bookings b where b.id = s.booking_id;

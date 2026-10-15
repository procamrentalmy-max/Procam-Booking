-- Batteries are now swapped between shops, so a battery's sticker name (its serial number: B1, B2, ... for the Neo 2, N1... for the Neo)
-- must be different across ALL shops, not just inside one shop (0046 numbered them per shop, so Kajang and Port Dickson both had a B1).
-- The batteries are renumbered once in shop order, keeping each make's letter: Kajang keeps B1 to B7 and Port Dickson's become B8 to B14.
-- The stickers on the Port Dickson batteries need to be changed to match.

drop index if exists uq_dr_batteries_shop_name;

with ranked as (
  select b.id,
         upper(regexp_replace(b.name, '[0-9]+$', '')) as prefix,
         row_number() over (
           partition by upper(regexp_replace(b.name, '[0-9]+$', ''))
           order by s.created_at, (regexp_replace(b.name, '^[^0-9]*', ''))::int, b.human_id
         ) as rn
  from dr_batteries b
  join dr_shops s on s.id = b.shop_id
  where b.name ~ '^[A-Za-z]+[0-9]+$'
)
update dr_batteries b set name = r.prefix || r.rn from ranked r where r.id = b.id;

create unique index uq_dr_batteries_name on dr_batteries (lower(name)) where name is not null;

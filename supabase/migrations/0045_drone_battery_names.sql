-- Every battery gets a short name the merchant can read off the sticker, so the handover and swap screens can say
-- exactly which battery to hand out ("DRN-001-B") instead of an internal id. Existing batteries are named after
-- their drone: DRN-001-A, DRN-001-B, DRN-001-C. The admin can rename any of them. (0046 replaces this scheme with
-- B1, B2, B3, ... numbered per shop.)
--
-- Nullable on purpose: a battery with no name falls back to its human_id on screen.

alter table dr_batteries add column name text;

update dr_batteries b
set name = d.human_id || '-' || chr(64 + n.rn::int)
from dr_drones d,
     (select id, row_number() over (partition by drone_id order by human_id) as rn from dr_batteries) n
where n.id = b.id and d.id = b.drone_id;

-- Two batteries can't share a name (case-insensitive), or the merchant could hand out the wrong one.
create unique index uq_dr_batteries_name on dr_batteries (lower(name)) where name is not null;

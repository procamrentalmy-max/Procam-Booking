-- Kits were a reception-era concept (a numbered handover pouch tracked as
-- its own stateful entity, separate from the camera). In the self-service
-- locker model, the accessories that ship with a camera are physically
-- fixed to that camera — the asset's own human_id already identifies the
-- whole set, and the pre-rental/return "lay out the kit and photograph it"
-- check (see check_templates item_key 'kit_full') already verifies the
-- accessories are present without needing a separately tracked object.
-- app/admin/kits, lib/booking/create.ts (the dead reception-era booking
-- creator that was the last thing still touching this table), and the
-- kits/kit_items tables themselves are all removed together.

alter table bookings drop constraint no_overlapping_kit_bookings;
alter table bookings drop column kit_id;

drop table kit_items;
drop table kits;

drop type kit_status;
drop sequence kits_human_id_seq;

-- Which guided photo step a handover/return photo answers (e.g. 'front', 'underside'); null on older photos.
alter table dr_checklist_photos add column item_key text;

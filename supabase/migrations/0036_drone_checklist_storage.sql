-- Private bucket for merchant-taken pickup/return condition photos (see
-- dr_checklist_photos in 0035_drone_rental_schema.sql). Same guarantee as
-- 0004_storage.sql's condition-photos bucket: no storage.objects RLS
-- policies, every upload/read goes through server code on the service-role
-- client (lib/droneRental/storage.ts) — a non-public bucket plus
-- service-role-only access is the whole story.

insert into storage.buckets (id, name, public)
values ('drone-checklist-photos', 'drone-checklist-photos', false)
on conflict (id) do nothing;

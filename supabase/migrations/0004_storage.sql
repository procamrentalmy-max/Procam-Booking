-- Private bucket for pre-rental/return condition photos and ID documents.
--
-- No storage.objects RLS policies are added here on purpose: every upload
-- and every read goes through server code using the service-role client
-- (lib/storage.ts) — customers never get a Supabase session to upload with
-- directly, and staff/admin view photos via signed URLs generated
-- server-side, not direct bucket access. A non-public bucket plus
-- service-role-only access is the whole guarantee.

insert into storage.buckets (id, name, public)
values ('condition-photos', 'condition-photos', false)
on conflict (id) do nothing;

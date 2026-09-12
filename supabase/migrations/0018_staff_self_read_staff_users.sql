-- A staff member needs to read their own staff_users row (role, active) to
-- resolve their auth context after login. The only existing policy
-- (admin_all_staff_users) is admin-only for every operation including
-- SELECT, so a non-admin PROCAM_STAFF account could authenticate with
-- Supabase successfully but getAuthContext() would still return null for
-- them, bouncing them back to /login as "not provisioned".
create policy self_read_staff_users on staff_users for select using (auth_user_id = auth.uid());

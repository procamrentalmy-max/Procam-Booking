-- Two SECURITY DEFINER functions ran with full power and no sign-in check, and were callable by anyone holding the public anon key
-- through /rest/v1/rpc/...: system_transition_asset_status (changes any asset's status) and create_locker_booking_atomic
-- (creates a locker booking). The app only ever calls them from the server with the service-role key, so nobody else needs them.
revoke execute on function public.system_transition_asset_status(uuid, asset_status, actor_type, uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.system_transition_asset_status(uuid, asset_status, actor_type, uuid, text, uuid, jsonb) to service_role;

revoke execute on function public.create_locker_booking_atomic(uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, booking_source, text) from public, anon, authenticated;
grant execute on function public.create_locker_booking_atomic(uuid, uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, booking_source, text) to service_role;

-- transition_asset_status checks is_procam_staff() itself and is called by signed-in staff, so it stays for them; the public needn't reach it.
revoke execute on function public.transition_asset_status(uuid, asset_status, text, uuid, jsonb) from public, anon;
grant execute on function public.transition_asset_status(uuid, asset_status, text, uuid, jsonb) to authenticated, service_role;

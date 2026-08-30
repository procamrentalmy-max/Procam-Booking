-- System-initiated rental asset transitions (customer/reception flows).
--
-- transition_asset_status (0002) is for an interactive staff/admin session:
-- it checks is_procam_staff() against auth.uid(). Calls made with the
-- service-role key (every customer-facing server action, since customers
-- never hold a Supabase session — see lib/supabase/service.ts) have no
-- auth.uid() at all, so that function always rejects them. This is the
-- equivalent entry point for those flows: it skips the staff check because
-- only the service_role Postgres role can execute it, and that role is only
-- ever held by our own trusted server code, which has already authorized
-- the action itself (a valid booking secure_token, a reception session,
-- etc.) before calling this.
create or replace function system_transition_asset_status(
  p_asset_id uuid,
  p_to_status asset_status,
  p_actor_type actor_type,
  p_actor_id uuid default null,
  p_event_type text default null,
  p_booking_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns rental_assets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset rental_assets;
  v_from asset_status;
begin
  select * into v_asset from rental_assets where id = p_asset_id for update;
  if not found then
    raise exception 'Asset % not found', p_asset_id;
  end if;

  v_from := v_asset.status;

  if not (p_to_status = any (asset_allowed_transitions(v_from))) then
    raise exception 'Asset cannot transition from % to %', v_from, p_to_status;
  end if;

  update rental_assets set status = p_to_status where id = p_asset_id
  returning * into v_asset;

  insert into asset_events (asset_type, asset_id, booking_id, event_type, from_status, to_status, actor_type, actor_id, metadata)
  values ('RENTAL_ASSET', p_asset_id, p_booking_id, coalesce(p_event_type, p_to_status::text), v_from::text, p_to_status::text, p_actor_type, p_actor_id, p_metadata);

  return v_asset;
end;
$$;

revoke execute on function system_transition_asset_status(uuid, asset_status, actor_type, uuid, text, uuid, jsonb) from public;
grant execute on function system_transition_asset_status(uuid, asset_status, actor_type, uuid, text, uuid, jsonb) to service_role;

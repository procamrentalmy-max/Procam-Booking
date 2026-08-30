-- Rental asset status transitions as a database-enforced RPC.
--
-- This mirrors lib/state-machine/asset.ts exactly. Duplicating the
-- transition table here matters because this function is reachable
-- directly via the Supabase client by any authenticated user (staff or
-- reception) once granted — the TypeScript state machine alone would only
-- protect callers that go through our server actions. Business rules must
-- hold at the database boundary too (spec section 32).

create or replace function asset_allowed_transitions(p_status asset_status)
returns asset_status[]
language sql
immutable
as $$
  select case p_status
    when 'AVAILABLE' then array['RESERVED','MAINTENANCE','LOST','RETIRED']::asset_status[]
    when 'RESERVED' then array['READY_FOR_PICKUP','AVAILABLE','LOST','RETIRED']::asset_status[]
    when 'READY_FOR_PICKUP' then array['RENTED','AVAILABLE','LOST','RETIRED']::asset_status[]
    when 'RENTED' then array['RETURNED_AWAITING_INSPECTION','LOST','RETIRED']::asset_status[]
    when 'RETURNED_AWAITING_INSPECTION' then array['INSPECTION','LOST','RETIRED']::asset_status[]
    when 'INSPECTION' then array['CLEANING','MAINTENANCE','LOST','RETIRED']::asset_status[]
    when 'CLEANING' then array['CHARGING','MAINTENANCE','LOST','RETIRED']::asset_status[]
    when 'CHARGING' then array['AVAILABLE','MAINTENANCE','LOST','RETIRED']::asset_status[]
    when 'MAINTENANCE' then array['AVAILABLE','LOST','RETIRED']::asset_status[]
    when 'LOST' then array['MAINTENANCE','RETIRED']::asset_status[]
    when 'RETIRED' then array[]::asset_status[]
  end;
$$;

create or replace function transition_asset_status(
  p_asset_id uuid,
  p_to_status asset_status,
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
  v_actor_type actor_type;
  v_actor_id uuid;
begin
  if not is_procam_staff() then
    raise exception 'Only ProCam staff or admin may change asset status';
  end if;

  if p_to_status in ('LOST', 'RETIRED') and not is_admin() then
    raise exception 'Only an admin may set an asset to %', p_to_status;
  end if;

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

  select id into v_actor_id from staff_users where auth_user_id = auth.uid();
  v_actor_type := case when is_admin() then 'ADMIN' else 'STAFF' end;

  insert into asset_events (asset_type, asset_id, booking_id, event_type, from_status, to_status, actor_type, actor_id, metadata)
  values ('RENTAL_ASSET', p_asset_id, p_booking_id, coalesce(p_event_type, p_to_status::text), v_from::text, p_to_status::text, v_actor_type, v_actor_id, p_metadata);

  return v_asset;
end;
$$;

revoke execute on function transition_asset_status(uuid, asset_status, text, uuid, jsonb) from public;
grant execute on function transition_asset_status(uuid, asset_status, text, uuid, jsonb) to authenticated;

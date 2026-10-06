-- The original DJI Neo joins the DJI Neo 2, a second shop (Port Dickson Beach) opens, and controllers stop being tied
-- one-to-one to drones.
--
-- Controllers are now a pool at each shop: a customer rents a drone and may add either an RC-N3 controller or the
-- Goggles N3 + RC Motion 3 set (or neither, flying from their own phone). Which controller goes with which drone is
-- decided per booking, and a controller can only be on one booking at a time (the same overlap rule drones have).
-- The prices for each choice live in lib/droneRental/pricingRules.ts; the database records the choice.
--
-- Kept for now so the previous release keeps working until the new one is live: dr_bookings.with_controller,
-- dr_walkin_requests.with_controller (a trigger keeps them equal to controller_kind <> 'NONE'),
-- dr_controllers.drone_id (now optional and unused) and the old p_with_controller argument of the booking function.

-- ---------------------------------------------------------------------------
-- 1. The Neo (original) is a drone model
-- ---------------------------------------------------------------------------
alter table dr_drones drop constraint dr_drones_model_key_check;
alter table dr_drones add constraint dr_drones_model_key_check check (model_key in ('NEO2', 'NEO', 'GT50'));
alter table dr_bookings drop constraint dr_bookings_drone_model_check;
alter table dr_bookings add constraint dr_bookings_drone_model_check check (drone_model in ('NEO2', 'NEO', 'GT50'));
alter table dr_walkin_requests drop constraint dr_walkin_requests_drone_model_check;
alter table dr_walkin_requests add constraint dr_walkin_requests_drone_model_check check (drone_model in ('NEO2', 'NEO', 'GT50'));

-- The Neo uses the Neo 2's handover/return checklist. A rental with the goggles set also checks the goggles.
update dr_checklist_items set applies_to = '{NEO2,NEO}' where applies_to = '{NEO2}';
insert into dr_checklist_items (item_key, label, sort_order, applies_to) values
  ('goggles_present', 'Goggles N3 and Motion 3 controller are present and working', 6, '{NEO2,NEO}')
on conflict (item_key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Controllers: a pool per shop, by kind
-- ---------------------------------------------------------------------------
alter table dr_controllers add column shop_id uuid references dr_shops(id);
alter table dr_controllers add column kind text not null default 'RC_N3' check (kind in ('RC_N3', 'GOGGLES_N3'));

update dr_controllers c set shop_id = d.shop_id from dr_drones d where d.id = c.drone_id;

-- Only one RC-N3 exists in real life (CTR-001); the other two were created automatically with the drones.
delete from dr_controllers where human_id in ('CTR-002', 'CTR-003');

alter table dr_controllers alter column shop_id set not null;
alter table dr_controllers drop constraint dr_controllers_drone_id_key;
alter table dr_controllers alter column drone_id drop not null;
update dr_controllers set drone_id = null;
create index idx_dr_controllers_shop on dr_controllers(shop_id);

-- CTR-001, CTR-002, ... for RC-N3 controllers; GOG-001, ... for Goggles N3 + Motion 3 sets (each counts across all shops).
create sequence dr_controllers_gog_seq;
select setval('dr_controllers_ctd_seq', 1, true);

create or replace function dr_controllers_set_human_id() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.kind = 'GOGGLES_N3' then
    new.human_id := next_human_id('dr_controllers_gog_seq', 'GOG', 3);
  else
    new.human_id := next_human_id('dr_controllers_ctd_seq', 'CTR', 3);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Which controller each booking and walk-in order is for
-- ---------------------------------------------------------------------------
alter table dr_bookings add column controller_kind text not null default 'RC_N3' check (controller_kind in ('NONE', 'RC_N3', 'GOGGLES_N3'));
alter table dr_bookings add column controller_id uuid references dr_controllers(id);
alter table dr_walkin_requests add column controller_kind text not null default 'RC_N3' check (controller_kind in ('NONE', 'RC_N3', 'GOGGLES_N3'));

update dr_bookings set controller_kind = case when with_controller then 'RC_N3' else 'NONE' end;
update dr_walkin_requests set controller_kind = case when with_controller then 'RC_N3' else 'NONE' end;

create or replace function dr_sync_with_controller() returns trigger
language plpgsql
as $$
begin
  new.with_controller := new.controller_kind <> 'NONE';
  return new;
end;
$$;
create trigger trg_dr_bookings_sync_with_controller before insert or update of controller_kind on dr_bookings
  for each row execute function dr_sync_with_controller();
create trigger trg_dr_walkin_requests_sync_with_controller before insert or update of controller_kind on dr_walkin_requests
  for each row execute function dr_sync_with_controller();

-- A controller can't be on two overlapping bookings, enforced by Postgres like the drone rule above.
alter table dr_bookings
  add constraint no_overlapping_controller_bookings
  exclude using gist (
    controller_id with =,
    tstzrange(start_time, end_time) with &&
  )
  where (controller_id is not null and status not in ('CANCELLED', 'EXPIRED', 'COMPLETED'));

-- Booking function: also records the controller choice and which controller was set aside.
drop function if exists create_drone_booking_atomic(uuid, uuid, uuid, timestamptz, timestamptz, numeric, numeric, text, dr_booking_source, uuid, smallint, text, boolean);

create or replace function create_drone_booking_atomic(
  p_customer_id uuid,
  p_shop_id uuid,
  p_drone_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_rental_fee_myr numeric,
  p_deposit_myr numeric,
  p_secure_token text,
  p_source dr_booking_source,
  p_created_by_staff_id uuid default null,
  p_batteries_count smallint default 2,
  p_drone_model text default 'NEO2',
  p_with_controller boolean default true,
  p_controller_kind text default null,
  p_controller_id uuid default null
)
returns dr_bookings
language plpgsql
set search_path = public
as $$
declare
  v_booking dr_bookings;
  v_kind text := coalesce(p_controller_kind, case when p_with_controller then 'RC_N3' else 'NONE' end);
begin
  insert into dr_bookings (
    customer_id, shop_id, drone_id, start_time, end_time,
    rental_fee_myr, deposit_myr, secure_token, source, created_by_staff_id,
    batteries_count, drone_model, controller_kind, controller_id, status
  ) values (
    p_customer_id, p_shop_id, p_drone_id, p_start_time, p_end_time,
    p_rental_fee_myr, p_deposit_myr, p_secure_token, p_source, p_created_by_staff_id,
    p_batteries_count, p_drone_model, v_kind, case when v_kind = 'NONE' then null else p_controller_id end, 'PENDING_PAYMENT'
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Stock: a second shop and the real fleet
-- ---------------------------------------------------------------------------
-- 6 Neo 2 + 14 batteries, 2 Neo + 6 batteries, split evenly over Kajang and Port Dickson Beach. The only controllers are
-- the one RC-N3 (CTR-001) and one Goggles N3 + Motion 3 set (GOG-001), both at Kajang.
-- (A battery belongs to one drone but fits any drone of the same model at its shop, so 7 batteries over 3 drones is 3 + 2 + 2.)
insert into dr_shops (name, address, lat, lng)
select 'Port Dickson Beach', 'Port Dickson Beach, Port Dickson, Negeri Sembilan', 2.4571, 101.8588
where not exists (select 1 from dr_shops where name = 'Port Dickson Beach');

delete from dr_batteries where name in ('B8', 'B9') and shop_id = (select id from dr_shops where name = 'Country Heights, Kajang');

do $$
declare
  kajang uuid := (select id from dr_shops where name = 'Country Heights, Kajang');
  pd uuid := (select id from dr_shops where name = 'Port Dickson Beach');
  d uuid;
  n int;
begin
  -- Port Dickson: 3 Neo 2 (batteries B1..B7: 3 + 2 + 2) and 1 Neo (N1..N3).
  n := 0;
  for i in 1..3 loop
    insert into dr_drones (shop_id, model_key, model) values (pd, 'NEO2', 'DJI Neo 2') returning id into d;
    for j in 1..(case when i = 1 then 3 else 2 end) loop
      n := n + 1;
      insert into dr_batteries (drone_id, name) values (d, 'B' || n);
    end loop;
  end loop;

  insert into dr_drones (shop_id, model_key, model, cost_price_myr) values (pd, 'NEO', 'DJI Neo', 800) returning id into d;
  for j in 1..3 loop insert into dr_batteries (drone_id, name) values (d, 'N' || j); end loop;

  -- Kajang: its 3 Neo 2 stay (batteries B1..B7), plus 1 Neo (N1..N3).
  insert into dr_drones (shop_id, model_key, model, cost_price_myr) values (kajang, 'NEO', 'DJI Neo', 800) returning id into d;
  for j in 1..3 loop insert into dr_batteries (drone_id, name) values (d, 'N' || j); end loop;

  insert into dr_controllers (shop_id, kind) values (kajang, 'GOGGLES_N3');
end;
$$;

update dr_drones set model = 'DJI Neo 2' where model_key = 'NEO2';

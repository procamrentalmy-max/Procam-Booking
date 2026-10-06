-- The DJI drones go back to DRN-001, DRN-002, ... and their controllers back to CTR-001, CTR-002, ... (the names before 0048
-- and 0049 split them by make). Batteries stay B1, B2, ... per shop.
--
-- The GT50 is parked (nothing offers it), but if it comes back its drones are still GT-001, ... and its controllers CTG-001,
-- ..., so those branches of the two triggers stay as they were.

create or replace function dr_drones_set_human_id() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.model_key = 'GT50' then
    new.human_id := next_human_id('dr_drones_gt_seq', 'GT', 3);
  else
    new.human_id := next_human_id('dr_drones_dji_seq', 'DRN', 3);
  end if;
  return new;
end;
$$;

create or replace function dr_controllers_set_human_id() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select model_key from dr_drones where id = new.drone_id) = 'GT50' then
    new.human_id := next_human_id('dr_controllers_ctg_seq', 'CTG', 3);
  else
    new.human_id := next_human_id('dr_controllers_ctd_seq', 'CTR', 3);
  end if;
  return new;
end;
$$;

update dr_drones set human_id = regexp_replace(human_id, '^DJI-', 'DRN-') where human_id like 'DJI-%';
update dr_controllers set human_id = regexp_replace(human_id, '^CTD-', 'CTR-') where human_id like 'CTD-%';

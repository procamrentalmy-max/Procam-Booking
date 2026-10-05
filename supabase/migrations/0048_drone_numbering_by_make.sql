-- Drones are numbered by make instead of all sharing DRN-: DJI Neo 2s are DJI-001, DJI-002, ... and GT50s are
-- GT-001, GT-002, ... Each make counts across every shop together, in the order the drones were added.
--
-- The number is chosen by a trigger from the drone's model, so nothing that inserts a drone has to pass one.
-- Existing drones are renamed in the order they were added; their ids (and every booking that points at them) are
-- unchanged, only the label the merchant reads.

create sequence dr_drones_dji_seq;
create sequence dr_drones_gt_seq;

alter table dr_drones alter column human_id drop default;

create or replace function dr_drones_set_human_id() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.model_key = 'GT50' then
    new.human_id := next_human_id('dr_drones_gt_seq', 'GT', 3);
  else
    new.human_id := next_human_id('dr_drones_dji_seq', 'DJI', 3);
  end if;
  return new;
end;
$$;

create trigger trg_dr_drones_set_human_id
  before insert on dr_drones
  for each row execute function dr_drones_set_human_id();

update dr_drones d
set human_id = x.new_id
from (
  select id,
         case when model_key = 'GT50' then 'GT-' else 'DJI-' end
           || lpad((row_number() over (partition by (model_key = 'GT50') order by created_at, human_id))::text, 3, '0') as new_id
  from dr_drones
) x
where x.id = d.id;

-- Carry on from however many of each make exist now (setval needs a value of at least 1, so an empty make starts fresh).
select setval('dr_drones_dji_seq', greatest((select count(*) from dr_drones where model_key <> 'GT50'), 1), (select count(*) from dr_drones where model_key <> 'GT50') > 0);
select setval('dr_drones_gt_seq', greatest((select count(*) from dr_drones where model_key = 'GT50'), 1), (select count(*) from dr_drones where model_key = 'GT50') > 0);

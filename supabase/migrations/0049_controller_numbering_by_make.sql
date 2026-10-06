-- Controllers are numbered by make too: a DJI controller is CTD-001, CTD-002, ... and a GT50 controller is CTG-001,
-- CTG-002, ... Each make counts across every shop together, in the order the controllers were added (like the drones in
-- 0048).
--
-- The number is chosen by a trigger from the controller's drone, so nothing that inserts a controller has to pass one.
-- Existing controllers are renamed in the order they were added; only the label changes.

create sequence dr_controllers_ctd_seq;
create sequence dr_controllers_ctg_seq;

alter table dr_controllers alter column human_id drop default;

create or replace function dr_controllers_set_human_id() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select model_key from dr_drones where id = new.drone_id) = 'GT50' then
    new.human_id := next_human_id('dr_controllers_ctg_seq', 'CTG', 3);
  else
    new.human_id := next_human_id('dr_controllers_ctd_seq', 'CTD', 3);
  end if;
  return new;
end;
$$;

create trigger trg_dr_controllers_set_human_id
  before insert on dr_controllers
  for each row execute function dr_controllers_set_human_id();

-- The old CTR-00x names can't collide with the new CTD-/CTG- ones, so a single update is safe despite human_id being unique.
update dr_controllers c
set human_id = x.new_id
from (
  select c2.id,
         case when d.model_key = 'GT50' then 'CTG-' else 'CTD-' end
           || lpad((row_number() over (partition by (d.model_key = 'GT50') order by c2.created_at, c2.human_id))::text, 3, '0') as new_id
  from dr_controllers c2
  join dr_drones d on d.id = c2.drone_id
) x
where x.id = c.id;

select setval('dr_controllers_ctd_seq', greatest((select count(*) from dr_controllers c join dr_drones d on d.id = c.drone_id where d.model_key <> 'GT50'), 1), (select count(*) from dr_controllers c join dr_drones d on d.id = c.drone_id where d.model_key <> 'GT50') > 0);
select setval('dr_controllers_ctg_seq', greatest((select count(*) from dr_controllers c join dr_drones d on d.id = c.drone_id where d.model_key = 'GT50'), 1), (select count(*) from dr_controllers c join dr_drones d on d.id = c.drone_id where d.model_key = 'GT50') > 0);

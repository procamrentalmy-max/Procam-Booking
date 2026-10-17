-- A battery belongs to a shop and a make (Neo 2, ...), not to one drone. Which batteries go out on a rental is picked by the merchant at handover.
drop trigger if exists trg_dr_batteries_set_shop on dr_batteries;
drop function if exists dr_batteries_set_shop();

alter table dr_batteries add column model_key text;
update dr_batteries b set model_key = coalesce((select d.model_key from dr_drones d where d.id = b.drone_id), 'NEO2');
alter table dr_batteries alter column model_key set not null;
alter table dr_batteries alter column model_key set default 'NEO2';
alter table dr_batteries alter column drone_id drop not null;
create index dr_batteries_model_idx on dr_batteries (model_key, at_shop_id, status);

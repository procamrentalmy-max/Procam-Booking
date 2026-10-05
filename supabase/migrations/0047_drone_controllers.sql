-- Controllers are tracked and numbered like drones: CTR-001, CTR-002, ... counted across every shop together, in the
-- order they were added (so the merchant can say exactly which controller goes out and which comes back). Each
-- controller belongs to one drone and is created together with it. Batteries are different: B1, B2, ... are numbered
-- inside each shop (0046).
--
-- Existing drones get their controllers in the order the drones were added.

create sequence dr_controllers_human_id_seq;

create table dr_controllers (
  id uuid primary key default gen_random_uuid(),
  human_id text not null unique default next_human_id('dr_controllers_human_id_seq', 'CTR', 3),
  drone_id uuid not null unique references dr_drones(id),
  created_at timestamptz not null default now()
);

alter table dr_controllers enable row level security;
create policy admin_all_dr_controllers on dr_controllers for all using (is_admin()) with check (is_admin());
create policy merchant_all_dr_controllers on dr_controllers for all using (is_drone_merchant()) with check (is_drone_merchant());

insert into dr_controllers (drone_id) select id from dr_drones order by created_at, human_id;

-- Drone numbers (DRN-001, ...) already count all drones across all shops in the order added. Test drones had used up
-- numbers, so continue from the highest drone that exists now rather than leave a gap before the next real one.
select setval('dr_drones_human_id_seq', coalesce((select max(substring(human_id from '[0-9]+$')::int) from dr_drones), 0), true);

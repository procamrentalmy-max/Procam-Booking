-- Which locker locations a worker is responsible for. A worker with no
-- rows here is treated as covering every locker (see lib/worker/route.ts) —
-- that keeps existing single-worker setups working unchanged until an
-- admin actually assigns specific lockers to specific workers.
create table worker_locker_assignments (
  worker_id uuid not null references workers(id) on delete cascade,
  partner_id uuid not null references partners(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (worker_id, partner_id)
);
create index idx_worker_locker_assignments_partner on worker_locker_assignments(partner_id);

alter table worker_locker_assignments enable row level security;

create policy admin_all_worker_locker_assignments on worker_locker_assignments
  for all using (is_admin()) with check (is_admin());

create policy staff_read_worker_locker_assignments on worker_locker_assignments
  for select using (is_procam_staff());

-- One picture for every combination a customer can book on the booking page: drone (Neo / Neo 2) x how it is flown
-- (phone only / RC-N3 / goggles) x batteries (1 / 2) = 12. The admin uploads them in Admin > Branding; the files live in the
-- public `branding` storage bucket and this table says which file is which. A combination with no row simply shows no picture.

create table dr_combo_pictures (
  drone_model text not null check (drone_model in ('NEO2', 'NEO', 'GT50')),
  controller_kind text not null check (controller_kind in ('NONE', 'RC_N3', 'GOGGLES_N3')),
  batteries smallint not null check (batteries in (1, 2)),
  image_path text not null,
  updated_at timestamptz not null default now(),
  primary key (drone_model, controller_kind, batteries)
);

alter table dr_combo_pictures enable row level security;
create policy admin_all_dr_combo_pictures on dr_combo_pictures for all using (is_admin()) with check (is_admin());

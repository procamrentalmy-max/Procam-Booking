-- The Tutorial page: any number of headers, each with any number of photos and videos, all set up by the admin in Admin > Tutorials.
-- The files live in the public `branding` storage bucket under `tutorial/`; these tables say which file belongs under which header,
-- in which order. The public Tutorial page reads them on the server, so there is no public access to the tables themselves.

create table tutorial_sections (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table tutorial_media (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references tutorial_sections (id) on delete cascade,
  kind text not null check (kind in ('image', 'video')),
  file_path text not null,
  caption text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index tutorial_media_section_position_idx on tutorial_media (section_id, position);

alter table tutorial_sections enable row level security;
alter table tutorial_media enable row level security;
create policy admin_all_tutorial_sections on tutorial_sections for all using (is_admin()) with check (is_admin());
create policy admin_all_tutorial_media on tutorial_media for all using (is_admin()) with check (is_admin());

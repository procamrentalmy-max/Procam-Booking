-- Site-wide branding: a logo the admin can upload themselves, used across
-- every customer-facing page and the admin/staff header. Public bucket
-- (unlike condition-photos) since the logo needs to render directly via a
-- stable public URL on pages with no Supabase session at all.

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

-- Singleton config row (id is always 1) rather than a key/value table —
-- there's exactly one setting so far and this keeps reads/writes trivial.
create table site_settings (
  id int primary key default 1 check (id = 1),
  logo_path text,
  updated_at timestamptz not null default now()
);

insert into site_settings (id) values (1);

alter table site_settings enable row level security;

create policy admin_all_site_settings on site_settings for all using (is_admin()) with check (is_admin());
-- Everyone needs to see the logo — landing pages, the booking wizard, and
-- the dashboard all render for customers with no Supabase session at all,
-- so this can't be staff-only like most other read policies in this schema.
create policy public_read_site_settings on site_settings for select using (true);

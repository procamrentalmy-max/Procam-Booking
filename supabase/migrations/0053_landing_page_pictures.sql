-- Two pictures on the landing page that the admin uploads (Admin > Branding), the same way as the logo: the picture at the
-- top of the page (instead of the drawn drone) and the one beside "What is in the kit". Both live in the public `branding`
-- storage bucket; null means "not uploaded", and the page falls back to the drawn drone / no picture.

alter table site_settings add column hero_image_path text;
alter table site_settings add column kit_image_path text;

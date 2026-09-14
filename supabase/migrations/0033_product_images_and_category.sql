-- Powers the landing page's Drones/Cameras/Photos grouping and an
-- admin-uploadable product picture. "Photos" isn't a category here since
-- the print service was never a rental_products row to begin with (see
-- app/p/[code]/page.tsx) -- it stays its own hardcoded section on the
-- landing page, unchanged.
create type product_category as enum ('DRONE', 'CAMERA');
alter table rental_products add column category product_category;
alter table rental_products add column image_path text;

update rental_products set category = 'DRONE' where slug = 'dji-neo-2-mini-drone';
update rental_products set category = 'CAMERA' where slug in ('insta360-adventure-camera', 'sealife-sportdiver-ultra');

alter table rental_products alter column category set not null;

-- Public bucket, same reasoning as branding.ts's logo bucket: the customer
-- landing page renders with no Supabase session at all, so the image URL
-- has to resolve without a signed-URL round trip.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Where a flyer place is: its address as a line of text and a Google Maps link. The QR code (dr_referrers.code) never changes, so a place can be renamed and moved to another shop later.
alter table dr_referrers add column if not exists address text;
alter table dr_referrers add column if not exists map_url text;

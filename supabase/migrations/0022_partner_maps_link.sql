-- A reference link for whoever is filling in location_travel_times by eye
-- from Google Maps — not used for any automated distance lookup, just
-- shown next to each locker's name in the admin travel-times editor.
alter table partners add column google_maps_url text;

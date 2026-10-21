-- The country a visit came from, as a two-letter code (MY, SG...), for the drone funnel and the location traffic. Only the country is kept, never an
-- IP address. It is filled in from the country the hosting platform works out for the request; visits before this column, and visits where it is not
-- known (the local copy of the site, say), have none.
alter table dr_funnel_events add column country text check (country ~ '^[A-Z]{2}$');
alter table dr_location_events add column country text check (country ~ '^[A-Z]{2}$');

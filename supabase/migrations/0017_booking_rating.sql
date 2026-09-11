-- Lets a customer rate their rental 1-5 stars after return. One rating per
-- booking, nullable (most bookings will never be rated), stored directly on
-- bookings rather than a separate table since it's a single scalar with no
-- independent lifecycle of its own.
alter table bookings
  add column rating smallint,
  add constraint bookings_rating_range check (rating is null or (rating between 1 and 5));

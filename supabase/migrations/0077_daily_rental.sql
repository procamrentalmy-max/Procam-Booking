-- A daily rental (1 to 3 days, 24 hours each from pickup) comes with 3 batteries and a charger, so a booking can now record 3 batteries.
-- Whether a booking is hourly or daily is not stored: a length that is a whole number of days (1440 minutes each) is daily, and hourly
-- rentals are never longer than 6 hours.
alter table dr_bookings drop constraint dr_bookings_batteries_count_check;
alter table dr_bookings add constraint dr_bookings_batteries_count_check check (batteries_count in (1, 2, 3));

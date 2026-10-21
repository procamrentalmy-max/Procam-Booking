-- Booking-page pictures for the daily rental, which has its own kit (3 batteries and a charger): they are kept under 3 batteries.
alter table dr_combo_pictures drop constraint dr_combo_pictures_batteries_check;
alter table dr_combo_pictures add constraint dr_combo_pictures_batteries_check check (batteries in (1, 2, 3));

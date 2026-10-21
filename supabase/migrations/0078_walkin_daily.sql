-- A walk-in order for a daily rental records the 3 batteries that come with it, like the booking made from it.
alter table dr_walkin_requests drop constraint dr_walkin_requests_batteries_count_check;
alter table dr_walkin_requests add constraint dr_walkin_requests_batteries_count_check check (batteries_count in (1, 2, 3));

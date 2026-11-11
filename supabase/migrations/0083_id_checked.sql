-- A customer can choose to pass the online ID check (Didit) and in return have only 40% of the deposit held on their card.
-- id_checked records that on the booking (and on the walk-in order until the staff confirm it), so the held amount, the
-- damage limit and the ID check cost in the shop's earnings all follow what was really done.
alter table dr_bookings add column id_checked boolean not null default false;
alter table dr_walkin_requests add column id_checked boolean not null default false;

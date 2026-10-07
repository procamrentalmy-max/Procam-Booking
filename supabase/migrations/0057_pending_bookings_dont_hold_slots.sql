-- An unpaid booking no longer holds a drone or controller. Before, whoever clicked "Book and pay" first got the slot even if they
-- never paid; now the slot goes to whoever PAYS first. Two people can be on the payment page for the last drone at the same
-- time; the first payment to go through claims it (the booking moves to CONFIRMED, which is when these rules apply) and the
-- other is told the last drone has been booked and refunded if they had already paid.
--
-- The overlap rules still protect everything that matters: a CONFIRMED or ACTIVE booking can't share a drone or a controller with
-- another one for overlapping times, enforced by Postgres itself.

alter table dr_bookings drop constraint no_overlapping_drone_bookings;
alter table dr_bookings
  add constraint no_overlapping_drone_bookings
  exclude using gist (
    drone_id with =,
    tstzrange(start_time, end_time) with &&
  )
  where (status not in ('PENDING_PAYMENT', 'CANCELLED', 'EXPIRED', 'COMPLETED'));

alter table dr_bookings drop constraint no_overlapping_controller_bookings;
alter table dr_bookings
  add constraint no_overlapping_controller_bookings
  exclude using gist (
    controller_id with =,
    tstzrange(start_time, end_time) with &&
  )
  where (controller_id is not null and status not in ('PENDING_PAYMENT', 'CANCELLED', 'EXPIRED', 'COMPLETED'));

-- Opening hours per shop, set by the admin in Admin > Drone Rental. A list of 7 entries, Sunday first (0) to Saturday (6): either null
-- (closed that day) or ["09:00", "18:00"] (opens, closes; on the half hour, Malaysia time). A shop with no hours set (null) keeps the old
-- default, 08:00 to 22:00 every day. Online bookings can only be made inside these hours (the rental must end by closing), and the
-- swap-at-any-shop list and the walk-in QR show the shop as closed outside them.

alter table dr_shops add column hours jsonb;

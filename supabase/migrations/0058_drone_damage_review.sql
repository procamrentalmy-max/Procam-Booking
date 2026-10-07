-- Damage is reviewed by the admin at night instead of the merchant typing an amount at the counter.
--
-- When a drone comes back with anything damaged, the merchant only says which item is damaged (and what happened). The customer's
-- deposit stays held on their card, the return is complete, and the booking waits here: damage_review is PENDING. In the nightly review
-- (Admin > Drone Rental > Damage review) the admin looks at the photos, types the amount for each damaged item, and that exact amount
-- is captured from the held deposit (the rest is released); damage_review then becomes DONE.
--
-- NONE: nothing was damaged, so there is nothing to review (a lost item with no damage is still charged in full right at the return).

alter table dr_bookings add column damage_review text not null default 'NONE' check (damage_review in ('NONE', 'PENDING', 'DONE'));
alter table dr_bookings add column damage_reviewed_at timestamptz;
create index idx_dr_bookings_damage_review on dr_bookings (damage_review) where damage_review = 'PENDING';

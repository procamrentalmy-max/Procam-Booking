-- What's actually rented out, and how the deposit is held and captured.
--
-- The kit is the drone, its RC-N3 controller, and 2 batteries (one in the
-- drone, one spare) — no case, no charging cable: all charging happens at
-- the shop. The deposit is a card hold of RM1,300: RM900 for the drone and
-- RM400 for the controller. At return each item is judged separately —
-- fine (nothing captured), lost (its full value captured), or damaged (the
-- assessed damage amount captured) — and the rest of the hold is released.
-- Replaces the earlier flat RM100 deposit with RM50/RM100 deductions.
--
-- Additive only: new columns default to "nothing found / nothing charged",
-- so existing rows (and the old return flow, if it ran) are unaffected.

alter table dr_bookings
  add column drone_outcome dr_deposit_outcome not null default 'NONE',
  add column controller_outcome dr_deposit_outcome not null default 'NONE',
  add column drone_charge_myr numeric(10, 2) not null default 0 check (drone_charge_myr >= 0),
  add column controller_charge_myr numeric(10, 2) not null default 0 check (controller_charge_myr >= 0),
  alter column deposit_myr set default 1300;

-- Checklist wording shared by pickup and return: names the controller, drops
-- the case/charging cable the customer never receives, and no longer says
-- the batteries are "charged" (the shop does that before handing them out).
update dr_checklist_items set label = 'Drone powers on and connects to the RC-N3 controller' where item_key = 'powers_on';
update dr_checklist_items set label = 'Both batteries are present (one in the drone, one spare)' where item_key = 'batteries_present';
update dr_checklist_items set item_key = 'controller_present', label = 'RC-N3 controller is present and working' where item_key = 'accessories_present';

alter table dr_drones alter column model set default 'DJI Neo 2 + RC-N3 controller';
update dr_drones set model = 'DJI Neo 2 + RC-N3 controller' where model = 'DJI Neo 2 Fly More Combo';

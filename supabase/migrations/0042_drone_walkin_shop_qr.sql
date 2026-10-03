-- Each shop gets a permanent code for its standing walk-in QR (customers scan it in the shop).
alter table dr_shops
  add column walkin_code text not null default md5(random()::text || clock_timestamp()::text);
create unique index dr_shops_walkin_code_key on dr_shops (walkin_code);

-- A walk-in order is now created by the customer from that QR: it has no drone chosen and no staff member
-- yet. The merchant confirms it, and the drone is assigned at that point.
alter table dr_walkin_requests
  alter column drone_id drop not null,
  alter column created_by_staff_id drop not null;

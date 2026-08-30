-- ProCam V1 — local/dev seed data
-- Applied automatically by `supabase db reset`. Fixed UUIDs are used so the
-- seed is reproducible and easy to reference while developing.

insert into partners (id, name, address, commission_rate, referral_code, status) values
  ('00000000-0000-0000-0000-000000000001', 'ABC Beach Hostel', 'Pantai Cenang, Langkawi', 0.20, 'ABC123', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000002', 'Sunset Bay Resort', 'Batu Ferringhi, Penang', 0.20, 'SBR456', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000003', 'Perhentian Backpackers', 'Pulau Perhentian, Terengganu', 0.20, 'PHB789', 'ACTIVE');

insert into rental_packages (name, duration_minutes, price_myr, deposit_myr, late_fee_per_hour_myr, active) values
  ('4 Hours', 240, 49.00, 300.00, 20.00, true),
  ('Day Pass (10 Hours)', 600, 79.00, 300.00, 20.00, true),
  ('24 Hours', 1440, 99.00, 300.00, 20.00, true);

insert into rental_assets (id, model, serial_number, partner_id, status, notes) values
  ('10000000-0000-0000-0000-000000000001', 'Insta360 Ace Pro', 'SN-AP-0001', '00000000-0000-0000-0000-000000000001', 'AVAILABLE', null),
  ('10000000-0000-0000-0000-000000000002', 'Insta360 Ace Pro', 'SN-AP-0002', '00000000-0000-0000-0000-000000000001', 'AVAILABLE', null),
  ('10000000-0000-0000-0000-000000000003', 'Insta360 Ace Pro', 'SN-AP-0003', '00000000-0000-0000-0000-000000000002', 'AVAILABLE', null),
  ('10000000-0000-0000-0000-000000000004', 'Insta360 Ace Pro', 'SN-AP-0004', '00000000-0000-0000-0000-000000000002', 'AVAILABLE', null),
  ('10000000-0000-0000-0000-000000000005', 'Insta360 Ace Pro', 'SN-AP-0005', '00000000-0000-0000-0000-000000000003', 'AVAILABLE', null),
  ('10000000-0000-0000-0000-000000000006', 'Insta360 Ace Pro', 'SN-AP-0006', '00000000-0000-0000-0000-000000000003', 'AVAILABLE', null),
  -- ProCam backup fleet, unassigned to any property.
  ('10000000-0000-0000-0000-000000000007', 'Insta360 Ace Pro', 'SN-AP-0007', null, 'MAINTENANCE', 'Backup unit'),
  ('10000000-0000-0000-0000-000000000008', 'Insta360 Ace Pro', 'SN-AP-0008', null, 'MAINTENANCE', 'Backup unit');

insert into kits (id, partner_id, status) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'AVAILABLE'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'AVAILABLE'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'AVAILABLE'),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'AVAILABLE'),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 'AVAILABLE'),
  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', 'AVAILABLE');

insert into kit_items (kit_id, item_name)
select k.id, item
from kits k
cross join (values ('Selfie Stick'), ('Wrist Strap'), ('Protective Case'), ('USB-C Charging Cable')) as items(item)
where k.partner_id is not null;

insert into batteries (id, partner_id, status) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'CHARGED'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'CHARGED'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'CHARGED'),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'CHARGED'),
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 'CHARGED'),
  ('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', 'CHARGED');

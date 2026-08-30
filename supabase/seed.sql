-- ProCam V1 — local/dev seed data
-- Applied automatically by `supabase db reset`. Fixed UUIDs are used so the
-- seed is reproducible and easy to reference while developing.

insert into partners (id, name, address, commission_rate, referral_code, status) values
  ('00000000-0000-0000-0000-000000000001', 'ABC Beach Hostel', 'Pantai Cenang, Langkawi', 0.20, 'ABC123', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000002', 'Sunset Bay Resort', 'Batu Ferringhi, Penang', 0.20, 'SBR456', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000003', 'Perhentian Backpackers', 'Pulau Perhentian, Terengganu', 0.20, 'PHB789', 'ACTIVE');

insert into rental_products (id, slug, internal_name, customer_facing_name, tagline, asset_prefix, uses_batteries, requires_phone_compatibility) values
  ('40000000-0000-0000-0000-000000000001', 'insta360-adventure-camera', 'Insta360 Adventure Camera', 'Insta360 Adventure Camera', 'Capture your whole adventure.', 'CAM', true, false),
  ('40000000-0000-0000-0000-000000000002', 'sealife-sportdiver-ultra', 'SeaLife SportDiver Ultra', 'Underwater Phone Camera', 'Use your own phone underwater.', 'SDU', false, true);

insert into rental_packages (product_id, name, duration_minutes, price_myr, deposit_myr, late_fee_per_hour_myr, active) values
  ('40000000-0000-0000-0000-000000000001', '4 Hours', 240, 49.00, 300.00, 20.00, true),
  ('40000000-0000-0000-0000-000000000001', 'Day Pass (10 Hours)', 600, 79.00, 300.00, 20.00, true),
  ('40000000-0000-0000-0000-000000000001', '24 Hours', 1440, 99.00, 300.00, 20.00, true),
  ('40000000-0000-0000-0000-000000000002', 'Snorkel Session', 120, 39.00, 200.00, 15.00, true),
  ('40000000-0000-0000-0000-000000000002', 'Half Day', 300, 59.00, 200.00, 15.00, true),
  ('40000000-0000-0000-0000-000000000002', 'Full Day', 600, 89.00, 200.00, 15.00, true);

insert into rental_assets (id, product_id, model, serial_number, partner_id, status, notes) values
  ('10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Insta360 Ace Pro', 'SN-AP-0001', '00000000-0000-0000-0000-000000000001', 'AVAILABLE', null),
  ('10000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'Insta360 Ace Pro', 'SN-AP-0002', '00000000-0000-0000-0000-000000000001', 'AVAILABLE', null),
  ('10000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', 'Insta360 Ace Pro', 'SN-AP-0003', '00000000-0000-0000-0000-000000000002', 'AVAILABLE', null),
  ('10000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000001', 'Insta360 Ace Pro', 'SN-AP-0004', '00000000-0000-0000-0000-000000000002', 'AVAILABLE', null),
  ('10000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000001', 'Insta360 Ace Pro', 'SN-AP-0005', '00000000-0000-0000-0000-000000000003', 'AVAILABLE', null),
  ('10000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000001', 'Insta360 Ace Pro', 'SN-AP-0006', '00000000-0000-0000-0000-000000000003', 'AVAILABLE', null),
  -- ProCam backup fleet, unassigned to any property.
  ('10000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000001', 'Insta360 Ace Pro', 'SN-AP-0007', null, 'MAINTENANCE', 'Backup unit'),
  ('10000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000001', 'Insta360 Ace Pro', 'SN-AP-0008', null, 'MAINTENANCE', 'Backup unit'),
  -- SeaLife SportDiver Ultra — smaller initial deployment, one per property.
  ('11000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'SeaLife SportDiver Ultra', 'SN-SDU-0001', '00000000-0000-0000-0000-000000000001', 'AVAILABLE', null),
  ('11000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'SeaLife SportDiver Ultra', 'SN-SDU-0002', '00000000-0000-0000-0000-000000000002', 'AVAILABLE', null),
  ('11000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', 'SeaLife SportDiver Ultra', 'SN-SDU-0003', '00000000-0000-0000-0000-000000000003', 'AVAILABLE', null),
  ('11000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000002', 'SeaLife SportDiver Ultra', 'SN-SDU-0004', null, 'MAINTENANCE', 'Backup unit');

insert into kits (id, product_id, partner_id, status) values
  ('20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'AVAILABLE'),
  ('20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'AVAILABLE'),
  ('20000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'AVAILABLE'),
  ('20000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'AVAILABLE'),
  ('20000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'AVAILABLE'),
  ('20000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'AVAILABLE'),
  ('21000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'AVAILABLE'),
  ('21000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'AVAILABLE'),
  ('21000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'AVAILABLE');

insert into kit_items (kit_id, item_name)
select k.id, item
from kits k
cross join (values ('Selfie Stick'), ('Wrist Strap'), ('Protective Case'), ('USB-C Charging Cable')) as items(item)
where k.partner_id is not null and k.product_id = '40000000-0000-0000-0000-000000000001';

insert into kit_items (kit_id, item_name)
select k.id, item
from kits k
cross join (values ('Wrist Tether'), ('Microfiber Cloth'), ('Silica Gel Pack')) as items(item)
where k.partner_id is not null and k.product_id = '40000000-0000-0000-0000-000000000002';

-- Check templates: what the customer/staff has to check at each phase, per
-- product. Replaces what used to be one hardcoded photo/checklist set.
insert into check_templates (product_id, phase, item_key, label, instruction, input_type, sort_order, required) values
  -- Insta360 — pre-rental
  ('40000000-0000-0000-0000-000000000001', 'PRE_RENTAL', 'screen_on', 'Power On', 'Turn the camera ON, then photograph the screen showing it''s powered on.', 'PHOTO', 1, true),
  ('40000000-0000-0000-0000-000000000001', 'PRE_RENTAL', 'lens_a', 'Lens A', 'Photograph the front lens closely.', 'PHOTO', 2, true),
  ('40000000-0000-0000-0000-000000000001', 'PRE_RENTAL', 'lens_b', 'Lens B', 'Photograph the second lens closely.', 'PHOTO', 3, true),
  ('40000000-0000-0000-0000-000000000001', 'PRE_RENTAL', 'kit_full', 'Full Kit', 'Lay out the camera and every accessory, then photograph it all together.', 'PHOTO', 4, true),
  ('40000000-0000-0000-0000-000000000001', 'PRE_RENTAL', 'ack_powers_on', 'The camera powers on and works.', null, 'BOOLEAN', 5, true),
  ('40000000-0000-0000-0000-000000000001', 'PRE_RENTAL', 'ack_no_damage', 'I don''t see any visible damage.', null, 'BOOLEAN', 6, true),
  ('40000000-0000-0000-0000-000000000001', 'PRE_RENTAL', 'ack_accessories_present', 'All the accessories shown in my kit photo are present.', null, 'BOOLEAN', 7, true),
  -- Insta360 — return
  ('40000000-0000-0000-0000-000000000001', 'RETURN', 'screen_on', 'Power On', 'Turn the camera ON, then photograph the screen showing it''s powered on.', 'PHOTO', 1, true),
  ('40000000-0000-0000-0000-000000000001', 'RETURN', 'lens_a', 'Lens A', 'Photograph the front lens closely.', 'PHOTO', 2, true),
  ('40000000-0000-0000-0000-000000000001', 'RETURN', 'lens_b', 'Lens B', 'Photograph the second lens closely.', 'PHOTO', 3, true),
  ('40000000-0000-0000-0000-000000000001', 'RETURN', 'kit_full', 'Full Kit', 'Lay out the camera and every accessory, then photograph it all together.', 'PHOTO', 4, true),
  -- Insta360 — staff inspection
  ('40000000-0000-0000-0000-000000000001', 'STAFF_INSPECTION', 'lens_a', 'Lens A', null, 'BOOLEAN', 1, true),
  ('40000000-0000-0000-0000-000000000001', 'STAFF_INSPECTION', 'lens_b', 'Lens B', null, 'BOOLEAN', 2, true),
  ('40000000-0000-0000-0000-000000000001', 'STAFF_INSPECTION', 'screen', 'Screen', null, 'BOOLEAN', 3, true),
  ('40000000-0000-0000-0000-000000000001', 'STAFF_INSPECTION', 'buttons', 'Buttons', null, 'BOOLEAN', 4, true),
  ('40000000-0000-0000-0000-000000000001', 'STAFF_INSPECTION', 'battery_compartment', 'Battery Compartment', null, 'BOOLEAN', 5, true),
  ('40000000-0000-0000-0000-000000000001', 'STAFF_INSPECTION', 'usb_port', 'USB / Charging Port', null, 'BOOLEAN', 6, true),
  ('40000000-0000-0000-0000-000000000001', 'STAFF_INSPECTION', 'water_ingress', 'No Water Ingress', null, 'BOOLEAN', 7, true),
  ('40000000-0000-0000-0000-000000000001', 'STAFF_INSPECTION', 'power', 'Powers On', null, 'BOOLEAN', 8, true),
  ('40000000-0000-0000-0000-000000000001', 'STAFF_INSPECTION', 'recording', 'Recording Works', null, 'BOOLEAN', 9, true),
  ('40000000-0000-0000-0000-000000000001', 'STAFF_INSPECTION', 'selfie_stick', 'Selfie Stick', null, 'BOOLEAN', 10, true),
  ('40000000-0000-0000-0000-000000000001', 'STAFF_INSPECTION', 'strap', 'Wrist Strap', null, 'BOOLEAN', 11, true),
  ('40000000-0000-0000-0000-000000000001', 'STAFF_INSPECTION', 'case', 'Case', null, 'BOOLEAN', 12, true),
  -- SeaLife — pre-rental
  ('40000000-0000-0000-0000-000000000002', 'PRE_RENTAL', 'housing_body', 'Housing Body', 'Photograph the full housing body.', 'PHOTO', 1, true),
  ('40000000-0000-0000-0000-000000000002', 'PRE_RENTAL', 'optical_window', 'Optical Window', 'Photograph the lens window closely.', 'PHOTO', 2, true),
  ('40000000-0000-0000-0000-000000000002', 'PRE_RENTAL', 'sealing_area', 'Sealing Area', 'Photograph the O-ring and sealing surface closely.', 'PHOTO', 3, true),
  ('40000000-0000-0000-0000-000000000002', 'PRE_RENTAL', 'locking_mechanism', 'Locking Mechanism', 'Photograph the locking latch.', 'PHOTO', 4, true),
  ('40000000-0000-0000-0000-000000000002', 'PRE_RENTAL', 'vacuum_components', 'Vacuum Components', 'Photograph the vacuum valve/indicator.', 'PHOTO', 5, true),
  ('40000000-0000-0000-0000-000000000002', 'PRE_RENTAL', 'wrist_tether', 'Wrist Tether', 'Photograph the wrist tether.', 'PHOTO', 6, true),
  ('40000000-0000-0000-0000-000000000002', 'PRE_RENTAL', 'kit_full', 'Full Kit', 'Lay out the housing and every accessory, then photograph it all together.', 'PHOTO', 7, true),
  ('40000000-0000-0000-0000-000000000002', 'PRE_RENTAL', 'seal_test_passed', 'I performed the vacuum/seal test and it passed.', null, 'BOOLEAN', 8, true),
  ('40000000-0000-0000-0000-000000000002', 'PRE_RENTAL', 'ack_no_damage', 'I don''t see any visible damage to the housing.', null, 'BOOLEAN', 9, true),
  -- SeaLife — return
  ('40000000-0000-0000-0000-000000000002', 'RETURN', 'housing_body', 'Housing Body', 'Photograph the full housing body.', 'PHOTO', 1, true),
  ('40000000-0000-0000-0000-000000000002', 'RETURN', 'optical_window', 'Optical Window', 'Photograph the lens window closely.', 'PHOTO', 2, true),
  ('40000000-0000-0000-0000-000000000002', 'RETURN', 'sealing_area', 'Sealing Area', 'Photograph the O-ring and sealing surface closely.', 'PHOTO', 3, true),
  ('40000000-0000-0000-0000-000000000002', 'RETURN', 'locking_mechanism', 'Locking Mechanism', 'Photograph the locking latch.', 'PHOTO', 4, true),
  ('40000000-0000-0000-0000-000000000002', 'RETURN', 'vacuum_components', 'Vacuum Components', 'Photograph the vacuum valve/indicator.', 'PHOTO', 5, true),
  ('40000000-0000-0000-0000-000000000002', 'RETURN', 'wrist_tether', 'Wrist Tether', 'Photograph the wrist tether.', 'PHOTO', 6, true),
  ('40000000-0000-0000-0000-000000000002', 'RETURN', 'kit_full', 'Full Kit', 'Lay out the housing and every accessory, then photograph it all together.', 'PHOTO', 7, true),
  -- SeaLife — staff inspection
  ('40000000-0000-0000-0000-000000000002', 'STAFF_INSPECTION', 'housing_body', 'Housing Body / Cracks', null, 'BOOLEAN', 1, true),
  ('40000000-0000-0000-0000-000000000002', 'STAFF_INSPECTION', 'optical_window', 'Optical Window', null, 'BOOLEAN', 2, true),
  ('40000000-0000-0000-0000-000000000002', 'STAFF_INSPECTION', 'o_ring_seal', 'O-Ring / Seal', null, 'BOOLEAN', 3, true),
  ('40000000-0000-0000-0000-000000000002', 'STAFF_INSPECTION', 'sealing_surface', 'Sealing Surface', null, 'BOOLEAN', 4, true),
  ('40000000-0000-0000-0000-000000000002', 'STAFF_INSPECTION', 'locking_latch', 'Locking Latch', null, 'BOOLEAN', 5, true),
  ('40000000-0000-0000-0000-000000000002', 'STAFF_INSPECTION', 'vacuum_system', 'Vacuum System', null, 'BOOLEAN', 6, true),
  ('40000000-0000-0000-0000-000000000002', 'STAFF_INSPECTION', 'moisture_leak_indicator', 'Moisture / Leak Indicator', null, 'BOOLEAN', 7, true),
  ('40000000-0000-0000-0000-000000000002', 'STAFF_INSPECTION', 'buttons', 'Physical Buttons', null, 'BOOLEAN', 8, true),
  ('40000000-0000-0000-0000-000000000002', 'STAFF_INSPECTION', 'bluetooth_functionality', 'Bluetooth / Functionality', null, 'BOOLEAN', 9, true),
  ('40000000-0000-0000-0000-000000000002', 'STAFF_INSPECTION', 'tether', 'Wrist Tether', null, 'BOOLEAN', 10, true),
  ('40000000-0000-0000-0000-000000000002', 'STAFF_INSPECTION', 'salt_residue', 'Salt Residue', null, 'BOOLEAN', 11, true),
  ('40000000-0000-0000-0000-000000000002', 'STAFF_INSPECTION', 'corrosion', 'Corrosion', null, 'BOOLEAN', 12, true),
  ('40000000-0000-0000-0000-000000000002', 'STAFF_INSPECTION', 'water_ingress_evidence', 'Evidence of Water Ingress', null, 'BOOLEAN', 13, true);

insert into batteries (id, partner_id, status) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'CHARGED'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'CHARGED'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'CHARGED'),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'CHARGED'),
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 'CHARGED'),
  ('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', 'CHARGED');

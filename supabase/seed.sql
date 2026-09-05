-- ProCam V1 — local/dev seed data
-- Applied automatically by `supabase db reset`. Fixed UUIDs are used so the
-- seed is reproducible and easy to reference while developing.

-- Langkawi self-service locker network (Phase 1 of the locker/routing
-- rebuild) — three locations the roaming worker services, ~10-15 min apart.
insert into partners (id, name, address, commission_rate, referral_code, status, pickup_method) values
  ('00000000-0000-0000-0000-000000000004', 'Cenang Beach Locker', 'Pantai Cenang, Langkawi', 0.20, 'LGK-CEN', 'ACTIVE', 'LOCKER'),
  ('00000000-0000-0000-0000-000000000005', 'Kuah Jetty Locker', 'Kuah Town, Langkawi', 0.20, 'LGK-KUA', 'ACTIVE', 'LOCKER'),
  ('00000000-0000-0000-0000-000000000006', 'Airport Locker', 'Langkawi International Airport', 0.20, 'LGK-AIR', 'ACTIVE', 'LOCKER');

insert into rental_products (id, slug, internal_name, customer_facing_name, tagline, asset_prefix, uses_batteries, requires_phone_compatibility) values
  ('40000000-0000-0000-0000-000000000001', 'insta360-adventure-camera', 'Insta360 Adventure Camera', 'Insta360 Adventure Camera', 'Capture your whole adventure.', 'CAM', true, false),
  ('40000000-0000-0000-0000-000000000002', 'sealife-sportdiver-ultra', 'SeaLife SportDiver Ultra', 'Underwater Phone Camera', 'Use your own phone underwater.', 'SDU', false, true);

-- Original reception-model packages — kept as inactive historical rows
-- rather than deleted (no bookings ever referenced them). Reception is
-- fully removed; every booking is a locker booking now, priced below.
insert into rental_packages (product_id, name, duration_minutes, price_myr, deposit_myr, late_fee_per_hour_myr, active) values
  ('40000000-0000-0000-0000-000000000001', '4 Hours', 240, 49.00, 300.00, 20.00, false),
  ('40000000-0000-0000-0000-000000000001', 'Day Pass (10 Hours)', 600, 79.00, 300.00, 20.00, false),
  ('40000000-0000-0000-0000-000000000001', '24 Hours', 1440, 99.00, 300.00, 20.00, false),
  ('40000000-0000-0000-0000-000000000002', 'Snorkel Session', 120, 39.00, 200.00, 15.00, false),
  ('40000000-0000-0000-0000-000000000002', 'Half Day', 300, 59.00, 200.00, 15.00, false),
  ('40000000-0000-0000-0000-000000000002', 'Full Day', 600, 89.00, 200.00, 15.00, false);

-- Langkawi locker-network packages — sized and priced from the profitability
-- simulation (4/5/6hr won total revenue at every demand level tested;
-- overnight modeled as a separate, unconflicted nightly slot). The only
-- active packages in the system now.
insert into rental_packages (product_id, name, duration_minutes, price_myr, deposit_myr, late_fee_per_hour_myr, active) values
  ('40000000-0000-0000-0000-000000000001', 'Locker Quick (4hr)', 240, 59.00, 300.00, 20.00, true),
  ('40000000-0000-0000-0000-000000000001', 'Locker Standard (5hr)', 300, 66.00, 300.00, 20.00, true),
  ('40000000-0000-0000-0000-000000000001', 'Locker Extended (6hr)', 360, 72.00, 300.00, 20.00, true),
  ('40000000-0000-0000-0000-000000000001', 'Locker Overnight (10pm-8am)', 600, 55.00, 300.00, 20.00, true);

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

-- Customer-facing setup/usage instructions, shown after pickup.
insert into product_instructions (product_id, step_number, title, body) values
  ('40000000-0000-0000-0000-000000000001', 1, 'Power On', 'Press and hold the side button for 2 seconds to turn the camera on.'),
  ('40000000-0000-0000-0000-000000000001', 2, 'Start / Stop Recording', 'Tap the shutter button once to start recording, tap again to stop.'),
  ('40000000-0000-0000-0000-000000000001', 3, 'Switch Mode', 'Swipe on the screen to switch between video, photo, and 360 mode.'),
  ('40000000-0000-0000-0000-000000000001', 4, '360 Recording', 'Select the 360 icon, then record as normal — reframe the shot later in the app.'),
  ('40000000-0000-0000-0000-000000000001', 5, 'Waterproof Limits', 'Safe underwater up to 10m without the extra dive case. Rinse with fresh water after any saltwater use.'),
  ('40000000-0000-0000-0000-000000000001', 6, 'Battery', 'Low battery? Message ProCam support from your booking page — mid-rental battery swaps aren''t available yet for locker rentals.'),
  ('40000000-0000-0000-0000-000000000001', 7, 'Protect the Lenses', 'Always use the lens cap when not filming, and avoid touching the glass directly.'),
  ('40000000-0000-0000-0000-000000000001', 8, 'Need Help?', 'Message ProCam support from your booking page any time during your rental.'),
  ('40000000-0000-0000-0000-000000000002', 1, 'Confirm Your Phone', 'Double-check the phone model you registered matches what''s in your hand.'),
  ('40000000-0000-0000-0000-000000000002', 2, 'Remove Your Case', 'Take off any phone case that would stop it sitting flush in the housing.'),
  ('40000000-0000-0000-0000-000000000002', 3, 'Get the SeaLife App', 'Download or open the SeaLife SportDiver app on your phone.'),
  ('40000000-0000-0000-0000-000000000002', 4, 'Enable Bluetooth', 'Turn on Bluetooth so your phone can pair with the housing.'),
  ('40000000-0000-0000-0000-000000000002', 5, 'Pair the Housing', 'In the SportDiver app, connect to your housing when prompted.'),
  ('40000000-0000-0000-0000-000000000002', 6, 'Inspect the Housing', 'Check the housing body for cracks or damage before use.'),
  ('40000000-0000-0000-0000-000000000002', 7, 'Check the Sealing Surface', 'Look closely at the O-ring and sealing surface — no sand, hair, or debris.'),
  ('40000000-0000-0000-0000-000000000002', 8, 'Insert Your Phone', 'Place your phone into the housing exactly as shown in the app guide.'),
  ('40000000-0000-0000-0000-000000000002', 9, 'Close and Lock', 'Close the housing fully and engage the locking latch.'),
  ('40000000-0000-0000-0000-000000000002', 10, 'Run the Seal Test', 'Use the housing''s vacuum/seal test before going near water.'),
  ('40000000-0000-0000-0000-000000000002', 11, 'Confirm the Seal', 'Only proceed once the seal test shows a successful result.'),
  ('40000000-0000-0000-0000-000000000002', 12, 'Attach the Tether', 'Loop the wrist tether around your wrist before entering the water.'),
  ('40000000-0000-0000-0000-000000000002', 13, 'Test the Controls', 'Try the shutter and recording controls on land first.'),
  ('40000000-0000-0000-0000-000000000002', 14, 'You''re Set', 'Once everything checks out, you''re ready to start.'),
  ('40000000-0000-0000-0000-000000000002', 15, 'Need Help?', 'Message ProCam support from your booking page any time during your rental.');

insert into product_terms_versions (product_id, version, body) values
  ('40000000-0000-0000-0000-000000000001', 1, 'You are responsible for the Insta360 camera and kit from pickup until ProCam staff inspect and pass its return. The security deposit is held until that inspection is complete and may be captured to cover loss or damage found at inspection.'),
  ('40000000-0000-0000-0000-000000000002', 1, 'You are responsible for the SeaLife SportDiver Ultra housing and kit from pickup until ProCam staff inspect and pass its return. The housing protects your own phone; ProCam is not responsible for water damage to your phone if the housing was not sealed correctly, including if the guided seal test was skipped or its result ignored. The security deposit covers the ProCam-owned housing and kit only, never your phone, and is held until inspection is complete.');

-- ============================================================================
-- LANGKAWI LOCKER NETWORK — pooled fleet + worker routing (Phase 1)
-- ============================================================================

-- One locker per location, 4 compartments each. Both compartment_count and
-- the travel-time matrix below are plain data — an admin screen to edit
-- them is on the roadmap (see plan doc), no schema change needed for that.
insert into lockers (id, human_id, partner_id, compartment_count) values
  ('50000000-0000-0000-0000-000000000001', 'LKR-001', '00000000-0000-0000-0000-000000000004', 4),
  ('50000000-0000-0000-0000-000000000002', 'LKR-002', '00000000-0000-0000-0000-000000000005', 4),
  ('50000000-0000-0000-0000-000000000003', 'LKR-003', '00000000-0000-0000-0000-000000000006', 4);

insert into locker_compartments (locker_id, compartment_number) values
  ('50000000-0000-0000-0000-000000000001', 1),
  ('50000000-0000-0000-0000-000000000001', 2),
  ('50000000-0000-0000-0000-000000000001', 3),
  ('50000000-0000-0000-0000-000000000001', 4),
  ('50000000-0000-0000-0000-000000000002', 1),
  ('50000000-0000-0000-0000-000000000002', 2),
  ('50000000-0000-0000-0000-000000000002', 3),
  ('50000000-0000-0000-0000-000000000002', 4),
  ('50000000-0000-0000-0000-000000000003', 1),
  ('50000000-0000-0000-0000-000000000003', 2),
  ('50000000-0000-0000-0000-000000000003', 3),
  ('50000000-0000-0000-0000-000000000003', 4);

-- Pooled fleet: 6 sellable cameras split 2/2/2 across the three locations,
-- plus 1 hot spare carried by the worker (no fixed partner_id).
insert into rental_assets (id, product_id, model, serial_number, partner_id, status, notes, is_hot_spare) values
  ('12000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Insta360 Ace Pro', 'SN-LGK-0001', '00000000-0000-0000-0000-000000000004', 'AVAILABLE', null, false),
  ('12000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'Insta360 Ace Pro', 'SN-LGK-0002', '00000000-0000-0000-0000-000000000004', 'AVAILABLE', null, false),
  ('12000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', 'Insta360 Ace Pro', 'SN-LGK-0003', '00000000-0000-0000-0000-000000000005', 'AVAILABLE', null, false),
  ('12000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000001', 'Insta360 Ace Pro', 'SN-LGK-0004', '00000000-0000-0000-0000-000000000005', 'AVAILABLE', null, false),
  ('12000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000001', 'Insta360 Ace Pro', 'SN-LGK-0005', '00000000-0000-0000-0000-000000000006', 'AVAILABLE', null, false),
  ('12000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000001', 'Insta360 Ace Pro', 'SN-LGK-0006', '00000000-0000-0000-0000-000000000006', 'AVAILABLE', null, false),
  ('12000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000001', 'Insta360 Ace Pro', 'SN-LGK-0007', null, 'AVAILABLE', 'Hot spare — carried by worker, rotates between locations', true);

-- Mock travel-time matrix between the three locations (~10-15 min, all
-- directional pairs). Replaced with live Google Maps data in a later phase.
insert into location_travel_times (from_partner_id, to_partner_id, minutes) values
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005', 12),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000004', 12),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000006', 15),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000004', 15),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000006', 10),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000005', 10);

-- No seed row for `workers`: staff_users.auth_user_id references a real
-- auth.users row, which plain SQL can't create. Once a real staff account
-- exists (Supabase Auth signup + a staff_users row), create its worker row
-- with: insert into workers (staff_user_id, current_partner_id) values
-- (<that staff_users.id>, '00000000-0000-0000-0000-000000000004');

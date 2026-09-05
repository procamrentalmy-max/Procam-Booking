-- Removes the reception-desk model entirely: the locker/worker-routing
-- system now handles 100% of pickups, and there are no reception
-- customers or reception staff logins left to support. Mirrors what
-- 0001_init.sql now looks like from scratch — this is the incremental
-- version for a project that was already deployed with the old model.

drop policy if exists reception_read_own_bookings on bookings;
drop policy if exists reception_read_own_rental_assets on rental_assets;
drop policy if exists reception_read_own_kits on kits;
drop policy if exists reception_read_own_kit_items on kit_items;
drop policy if exists reception_read_own_batteries on batteries;
drop policy if exists reception_read_own_battery_exchanges on battery_exchanges;
drop policy if exists reception_read_own_customers on customers;
drop policy if exists reception_insert_own_asset_events on asset_events;
drop policy if exists admin_all_partner_users on partner_users;

drop function if exists current_reception_partner_id();

alter table battery_exchanges drop column if exists performed_by_partner_user_id;

drop table if exists partner_users;

-- pickup_method 'RECEPTION' and actor_type 'RECEPTION' are left defined
-- but unused — dropping an enum VALUE (not the type) requires recreating
-- the type and every column using it, which is a lot of risk for a value
-- that just sits inert going forward. Nothing will ever write it again
-- now that no reception partners or reception code paths exist.

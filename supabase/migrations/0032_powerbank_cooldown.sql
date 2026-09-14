-- Powers the "power bank attaches to a DJI Neo 2 3hr+ booking" feature.
-- CHARGING is reused as the post-rental cooldown state (already exists,
-- reads naturally as "temporarily unavailable, recharging") rather than
-- adding a new battery_status value. cooldown_until is when a CHARGING
-- bank becomes assignable again -- nothing else in the schema tracked a
-- return timestamp for batteries before this.
alter table batteries add column cooldown_until timestamptz;

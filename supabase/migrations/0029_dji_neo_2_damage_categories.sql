-- DJI Neo 2 specific damage categories, same "one combined enum, filtered by
-- product in the UI" pattern as the SeaLife additions in 0001_init.sql.
-- LENS_SCRATCH/SEVERE_LENS_DAMAGE/BODY_DAMAGE/WATER_DAMAGE/MISSING_ACCESSORY/
-- MISSING_BATTERY/FUNCTIONALITY_ISSUE/OTHER are all reused as-is (a drone's
-- gimbal camera lens, body, and battery aren't meaningfully different from a
-- regular camera's for damage-reporting purposes). These four are the
-- actually-distinct drone failure modes: the propellers and their guard
-- cage are separate components that fail independently, the gimbal is a
-- distinct mechanical assembly from the lens itself, and a drone can be
-- lost entirely (crashed into water/bushes) in a way "CAMERA_MISSING"
-- doesn't read naturally for.
alter type damage_category add value 'PROPELLER_DAMAGE';
alter type damage_category add value 'PROP_GUARD_DAMAGE';
alter type damage_category add value 'GIMBAL_DAMAGE';
alter type damage_category add value 'DRONE_LOST';

-- Adds the merchant role for the new merchant-mediated drone rental vertical
-- (see 0035_drone_rental_schema.sql). Kept in its own migration file: Postgres
-- won't let a brand new enum value be *used* (e.g. in a later insert or a
-- staff_role = 'DRONE_MERCHANT' RLS check) within the same transaction that
-- added it, so 0035 has to land in a separate migration run after this one.
alter type staff_role add value 'DRONE_MERCHANT';

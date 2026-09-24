-- Adds the late-fee payment kind (see lib/droneRental/payment.ts::chargeLateFee).
-- Own migration file for the same reason 0034_drone_merchant_role.sql is:
-- a new enum value can't be used in the same transaction that added it.
alter type dr_payment_kind add value 'LATE_FEE';

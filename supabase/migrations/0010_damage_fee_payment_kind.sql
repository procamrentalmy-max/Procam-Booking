-- Admin damage-case resolution can capture money from the deposit hold for
-- damage, same mechanism as the late fee (0009) but a distinct payment kind
-- so the two are never conflated in reporting.

alter type payment_kind add value 'DAMAGE_FEE';

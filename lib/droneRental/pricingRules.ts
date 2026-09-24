/**
 * Single source of truth for the drone rental vertical's pricing/scheduling
 * constants. Flat constants rather than an admin-editable table (unlike
 * ProCam's rental_packages) — this vertical launches with one product (DJI
 * Neo 2 Fly More Combo) and one rate plan, so there's no tier grid to make
 * editable yet. Revisit if/when a second product or rate plan shows up.
 */

/** First hour's rate — bundles the initial BATTERIES_INCLUDED handout, so it costs more than a plain additional hour. */
export const FIRST_HOUR_RATE_MYR = 20;

/** Every hour after the first — no extra batteries bundled in (those come via a paid swap — see BATTERY_SWAP_FEE_MYR). */
export const ADDITIONAL_HOUR_RATE_MYR = 10;

/** Batteries handed out at pickup, included in the first-hour rate. */
export const BATTERIES_INCLUDED = 2;

/** A customer can hold at most this many batteries at once — swapping in one more requires returning one first. */
export const MAX_BATTERIES_HELD = 2;

/** Charged per battery swapped in beyond the initial handout. */
export const BATTERY_SWAP_FEE_MYR = 7;

/** Refundable security deposit taken at booking. */
export const DEPOSIT_MYR = 100;

/** Kept from the deposit if the drone/kit comes back damaged in any way. */
export const DAMAGE_DEDUCTION_MYR = 50;

/** Kept from the deposit (the full amount) if equipment is lost. */
export const LOSS_DEDUCTION_MYR = DEPOSIT_MYR;

/** Rental fee for a booking of this many minutes: FIRST_HOUR_RATE_MYR for the first hour, ADDITIONAL_HOUR_RATE_MYR for every hour after, rounded up to the nearest whole hour. */
export function rentalFeeMyr(durationMinutes: number): number {
  const hours = Math.ceil(durationMinutes / 60);
  if (hours <= 0) return 0;
  return FIRST_HOUR_RATE_MYR + (hours - 1) * ADDITIONAL_HOUR_RATE_MYR;
}

/** How much of the deposit the merchant actually keeps for a given return outcome. */
export function depositDeductionMyr(outcome: "NONE" | "DAMAGED" | "LOST"): number {
  if (outcome === "LOST") return LOSS_DEDUCTION_MYR;
  if (outcome === "DAMAGED") return DAMAGE_DEDUCTION_MYR;
  return 0;
}

/**
 * A late return is billed like tacking on extra ADDITIONAL_HOUR_RATE_MYR
 * hours — not the first-hour rate, since lateness isn't a new rental with
 * its own battery handout, just running over on the existing one. Rounded
 * up: any part of an hour late is billed as a full hour, same convention
 * ProCam's own lib/booking/lateFee.ts uses.
 */
export function lateFeeMyr(minutesLate: number): number {
  if (minutesLate <= 0) return 0;
  return Math.ceil(minutesLate / 60) * ADDITIONAL_HOUR_RATE_MYR;
}

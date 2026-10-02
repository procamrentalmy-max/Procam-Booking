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

/**
 * The deposit is a card hold sized to what's actually handed over: the
 * drone and the controller are each held for their own replacement value.
 * (The batteries aren't part of it — they're charged and kept at the shop.)
 */
export const DEPOSIT_DRONE_MYR = 900;
export const DEPOSIT_CONTROLLER_MYR = 400;
export const DEPOSIT_MYR = DEPOSIT_DRONE_MYR + DEPOSIT_CONTROLLER_MYR;

/** "RM1,300" — thousands separator so a four-digit deposit stays readable. */
export function formatMyr(amount: number): string {
  return `RM${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** Rental fee for a booking of this many minutes: FIRST_HOUR_RATE_MYR for the first hour, ADDITIONAL_HOUR_RATE_MYR for every hour after, rounded up to the nearest whole hour. */
export function rentalFeeMyr(durationMinutes: number): number {
  const hours = Math.ceil(durationMinutes / 60);
  if (hours <= 0) return 0;
  return FIRST_HOUR_RATE_MYR + (hours - 1) * ADDITIONAL_HOUR_RATE_MYR;
}

export type ItemOutcome = "NONE" | "DAMAGED" | "LOST";
/** What the merchant found for one item at return. `damageMyr` is only read when the outcome is DAMAGED. */
export type ItemReturn = { outcome: ItemOutcome; damageMyr?: number };

export type DepositCapture = {
  droneChargeMyr: number;
  controllerChargeMyr: number;
  totalMyr: number;
  /** Worst of the two items — what's stored as the booking's single headline outcome. */
  overallOutcome: ItemOutcome;
};

export class DepositCaptureError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "DepositCaptureError";
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * What to capture for one item: nothing if it's fine, its full value if
 * it's lost, and whatever damage amount the merchant assessed if it's
 * damaged (never more than the item's own deposit — the hold can't cover
 * more than that item was held for).
 */
export function itemCaptureMyr(itemName: string, itemValueMyr: number, item: ItemReturn): number {
  if (item.outcome === "NONE") return 0;
  if (item.outcome === "LOST") return itemValueMyr;

  const damage = item.damageMyr;
  if (damage === undefined || !Number.isFinite(damage) || damage <= 0) {
    throw new DepositCaptureError(`Enter the damage charge for the ${itemName}.`);
  }
  if (damage > itemValueMyr) {
    throw new DepositCaptureError(`The ${itemName} damage charge can't be more than its ${formatMyr(itemValueMyr)} deposit.`);
  }
  return round2(damage);
}

/** Total to capture from the held deposit; whatever isn't captured is released back to the customer. */
export function computeDepositCapture(drone: ItemReturn, controller: ItemReturn): DepositCapture {
  const droneChargeMyr = itemCaptureMyr("drone", DEPOSIT_DRONE_MYR, drone);
  const controllerChargeMyr = itemCaptureMyr("controller", DEPOSIT_CONTROLLER_MYR, controller);
  const outcomes = [drone.outcome, controller.outcome];
  const overallOutcome: ItemOutcome = outcomes.includes("LOST") ? "LOST" : outcomes.includes("DAMAGED") ? "DAMAGED" : "NONE";
  return { droneChargeMyr, controllerChargeMyr, totalMyr: round2(droneChargeMyr + controllerChargeMyr), overallOutcome };
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

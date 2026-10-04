/**
 * Single source of truth for the drone rental vertical's pricing/scheduling
 * constants. Flat constants rather than an admin-editable table (unlike
 * ProCam's rental_packages) — this vertical launches with one product (DJI
 * Neo 2 Fly More Combo) and one rate plan, so there's no tier grid to make
 * editable yet. Revisit if/when a second product or rate plan shows up.
 */

/** Rental time costs this much for every hour booked, however many hours that is. */
export const HOURLY_RATE_MYR = 10;

/** The customer chooses how many batteries to start with when they book. */
export const BATTERY_OPTIONS = [1, 2] as const;
export type BatteryCount = (typeof BATTERY_OPTIONS)[number];
export const DEFAULT_BATTERIES: BatteryCount = 2;

export function isBatteryCount(value: unknown): value is BatteryCount {
  return (BATTERY_OPTIONS as readonly unknown[]).includes(value);
}

/**
 * What each battery choice costs: 1 battery RM7, 2 batteries RM10. The same prices apply to swapping used
 * batteries for fully charged ones mid-rental (1 swapped RM7, 2 swapped RM10).
 */
export const BATTERY_PACKAGE_FEE_MYR: Record<BatteryCount, number> = { 1: 7, 2: 10 };

/**
 * The drone models the shop rents out. Everything that differs between them lives in DRONE_MODEL_PROFILES below;
 * the constants above and the DEPOSIT_* ones further down are the DJI Neo 2's. The GT50 is the cheaper drone:
 * RM7 an hour (RM3 less), batteries RM5 for 1 or RM8 for 2 (also the swap prices), the same RM7 an hour for late fees,
 * a RM150 deposit, and no handover or return photos (a short checklist instead).
 */
export const DRONE_MODELS = ["NEO2", "GT50"] as const;
export type DroneModel = (typeof DRONE_MODELS)[number];
export const DEFAULT_DRONE_MODEL: DroneModel = "NEO2";

export function isDroneModel(value: unknown): value is DroneModel {
  return (DRONE_MODELS as readonly unknown[]).includes(value);
}

export type DroneModelProfile = {
  key: DroneModel;
  /** What the customer sees: the drone and what comes with it. */
  name: string;
  /** Just the drone. */
  shortName: string;
  controllerName: string;
  /** Per hour booked, and also the late fee per hour. */
  hourlyRateMyr: number;
  /** What each battery choice costs, and also the price of swapping that many mid-rental. */
  batteryFeeMyr: Record<BatteryCount, number>;
  depositDroneMyr: number;
  depositControllerMyr: number;
  /** Whether the merchant takes guided photos at handover and return. */
  photosRequired: boolean;
  /** About how many minutes of flying each battery choice gives, ready to show; null when it isn't known, so nothing is claimed. */
  flightMinutes: Record<BatteryCount, string> | null;
};

export const DRONE_MODEL_PROFILES: Record<DroneModel, DroneModelProfile> = {
  NEO2: {
    key: "NEO2",
    name: "DJI Neo 2 + RC-N3 controller",
    shortName: "DJI Neo 2",
    controllerName: "RC-N3 controller",
    hourlyRateMyr: HOURLY_RATE_MYR,
    batteryFeeMyr: BATTERY_PACKAGE_FEE_MYR,
    depositDroneMyr: 900,
    depositControllerMyr: 400,
    photosRequired: true,
    flightMinutes: { 1: "12–15", 2: "25–30" },
  },
  GT50: {
    key: "GT50",
    name: "GT50 + controller",
    shortName: "GT50",
    controllerName: "Controller",
    hourlyRateMyr: 7,
    batteryFeeMyr: { 1: 5, 2: 8 },
    depositDroneMyr: 100,
    depositControllerMyr: 50,
    photosRequired: false,
    flightMinutes: null,
  },
};

/** The profile for a stored model value; anything unrecognised (or missing, on rows from before models existed) is the Neo 2. */
export function modelProfile(model: string | null | undefined): DroneModelProfile {
  return isDroneModel(model) ? DRONE_MODEL_PROFILES[model] : DRONE_MODEL_PROFILES[DEFAULT_DRONE_MODEL];
}

/** Total deposit hold for a model: drone + controller. */
export function depositMyrFor(model: string | null | undefined): number {
  const p = modelProfile(model);
  return p.depositDroneMyr + p.depositControllerMyr;
}

/** A customer can hold at most this many batteries at once — swapping in one more requires returning one first. */
export const MAX_BATTERIES_HELD = 2;


/**
 * (The DJI Neo 2's figures; each model's own are in DRONE_MODEL_PROFILES.)
 * The deposit is a card hold sized to what's actually handed over: the
 * drone and the controller are each held for their own replacement value.
 * (The batteries aren't part of it — they're charged and kept at the shop.)
 */
export const DEPOSIT_DRONE_MYR = DRONE_MODEL_PROFILES.NEO2.depositDroneMyr;
export const DEPOSIT_CONTROLLER_MYR = DRONE_MODEL_PROFILES.NEO2.depositControllerMyr;
export const DEPOSIT_MYR = DEPOSIT_DRONE_MYR + DEPOSIT_CONTROLLER_MYR;

/** About how long one full battery flies (same figure the hotel-locker flow tells customers). Shown so nobody thinks a 2-hour rental means 2 hours in the air. */
export const BATTERY_FLIGHT_MINUTES_MIN = 12;
export const BATTERY_FLIGHT_MINUTES_MAX = 15;

/** The same figures for what a customer actually starts with, ready to show: 1 battery ~12–15 min, 2 batteries ~25–30 min. */
export const BATTERY_FLIGHT_LABEL: Record<BatteryCount, string> = { 1: "12–15", 2: "25–30" };

/** "RM1,300" — thousands separator so a four-digit deposit stays readable. */
export function formatMyr(amount: number): string {
  return `RM${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** The lengths an online customer can book: whole hours, 1 to 6. Checked on the server too, since a form can be posted with anything. */
export const MIN_RENTAL_HOURS = 1;
export const MAX_RENTAL_HOURS = 6;
export function isValidRentalMinutes(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes % 60 === 0 && minutes >= MIN_RENTAL_HOURS * 60 && minutes <= MAX_RENTAL_HOURS * 60;
}

/** Rental fee: the model's hourly rate for every hour (a partial hour counts as a full one) plus the price of the chosen batteries. */
export function rentalFeeMyr(durationMinutes: number, batteries: BatteryCount = DEFAULT_BATTERIES, model: string | null | undefined = DEFAULT_DRONE_MODEL): number {
  const hours = Math.ceil(durationMinutes / 60);
  if (hours <= 0) return 0;
  const profile = modelProfile(model);
  return hours * profile.hourlyRateMyr + profile.batteryFeeMyr[batteries];
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
export function computeDepositCapture(drone: ItemReturn, controller: ItemReturn, model: string | null | undefined = DEFAULT_DRONE_MODEL): DepositCapture {
  const profile = modelProfile(model);
  const droneChargeMyr = itemCaptureMyr("drone", profile.depositDroneMyr, drone);
  const controllerChargeMyr = itemCaptureMyr("controller", profile.depositControllerMyr, controller);
  const outcomes = [drone.outcome, controller.outcome];
  const overallOutcome: ItemOutcome = outcomes.includes("LOST") ? "LOST" : outcomes.includes("DAMAGED") ? "DAMAGED" : "NONE";
  return { droneChargeMyr, controllerChargeMyr, totalMyr: round2(droneChargeMyr + controllerChargeMyr), overallOutcome };
}

/**
 * A late return is billed like tacking on extra HOURLY_RATE_MYR
 * hours — not the first-hour rate, since lateness isn't a new rental with
 * its own battery handout, just running over on the existing one. Rounded
 * up: any part of an hour late is billed as a full hour, same convention
 * ProCam's own lib/booking/lateFee.ts uses.
 */
export function lateFeeMyr(minutesLate: number, model: string | null | undefined = DEFAULT_DRONE_MODEL): number {
  if (minutesLate <= 0) return 0;
  return Math.ceil(minutesLate / 60) * modelProfile(model).hourlyRateMyr;
}

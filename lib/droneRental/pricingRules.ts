import { DAILY_RENTAL_ENABLED } from "@/lib/features";

/**
 * Single source of truth for the drone rental vertical's pricing/scheduling
 * constants. Flat constants rather than an admin-editable table (unlike
 * ProCam's rental_packages) — the vertical rents two DJI drones (the Neo 2 and the older Neo) with one rate plan
 * each, so there's no tier grid to make editable yet.
 */

/** Rental time costs this much for every hour booked, however many hours that is. */
export const HOURLY_RATE_MYR = 15;

/** The customer chooses how many batteries to start with when they book. */
export const BATTERY_OPTIONS = [1, 2] as const;
export type BatteryCount = (typeof BATTERY_OPTIONS)[number];
export const DEFAULT_BATTERIES: BatteryCount = 2;

export function isBatteryCount(value: unknown): value is BatteryCount {
  return (BATTERY_OPTIONS as readonly unknown[]).includes(value);
}

/**
 * What each battery choice costs: 1 battery RM8, 2 batteries RM14. The same prices apply to swapping used
 * batteries for fully charged ones mid-rental (1 swapped RM8, 2 swapped RM14).
 */
export const BATTERY_PACKAGE_FEE_MYR: Record<BatteryCount, number> = { 1: 8, 2: 14 };

/**
 * The drone models the shop rents out. Everything that differs between them lives in DRONE_MODEL_PROFILES below;
 * the constants above and the DEPOSIT_* ones further down are the DJI Neo 2's. The Neo (the original) is RM1 cheaper
 * on everything but the controllers: RM9 an hour, batteries RM6 for 1 or RM9 for 2 (also the swap prices), a RM9 late
 * fee per hour without a controller. The drone deposits are RM700 (Neo 2) and RM600 (Neo). The GT50 is parked (see ENABLED_DRONE_MODELS).
 */
export const DRONE_MODELS = ["NEO2", "NEO", "GT50"] as const;

/**
 * The models actually offered right now. The GT50 is parked: its profile, numbering, photos and tests all still exist, but
 * nothing offers it (no booking choice, no walk-in choice, no Add-a-drone option) until it is added here again. To bring it
 * back, put "GT50" in this list, add its drones in the admin, and see the project memory note "GT50 parked" for everything
 * else that was true of it.
 */
export const ENABLED_DRONE_MODELS = ["NEO2", "NEO"] as const;
export type DroneModel = (typeof DRONE_MODELS)[number];
export const DEFAULT_DRONE_MODEL: DroneModel = "NEO2";

export function isDroneModel(value: unknown): value is DroneModel {
  return (DRONE_MODELS as readonly unknown[]).includes(value);
}

/**
 * How a customer flies the drone. NONE is their own phone with the DJI Fly app; the other two are rented from the shop
 * and cost extra per hour (and a deposit of their own). The same prices apply to every drone, the Neo and the Neo 2 alike.
 */
export const CONTROLLER_KINDS = ["NONE", "RC_N3", "GOGGLES_N3"] as const;
export type ControllerKind = (typeof CONTROLLER_KINDS)[number];
/** The controllers that are actual equipment (everything but NONE). */
export type ControllerEquipment = Exclude<ControllerKind, "NONE">;

/** What a rental with a controller has been so far: every older booking, and what a booking gets when nothing else is said. */
export const DEFAULT_CONTROLLER: ControllerKind = "RC_N3";

export function isControllerKind(value: unknown): value is ControllerKind {
  return (CONTROLLER_KINDS as readonly unknown[]).includes(value);
}

export type ControllerProfile = {
  key: ControllerEquipment;
  /** Full name, shown when it is handed out and taken back. */
  name: string;
  /** Short name, for a table or a summary line. */
  shortName: string;
  /** What it adds to the price per hour, and to the late fee per hour. */
  hourlyMyr: number;
  /** What is held on the card for it, on top of the drone's deposit. */
  depositMyr: number;
};

export const CONTROLLER_PROFILES: Record<ControllerEquipment, ControllerProfile> = {
  RC_N3: { key: "RC_N3", name: "RC-N3 controller", shortName: "Controller (RC-N3)", hourlyMyr: 9, depositMyr: 400 },
  GOGGLES_N3: { key: "GOGGLES_N3", name: "Goggles N3 + Motion 3 controller", shortName: "Goggles N3 + Motion 3", hourlyMyr: 10, depositMyr: 800 },
};

export type DroneModelProfile = {
  key: DroneModel;
  /** What the customer sees: the drone and what comes with it. */
  name: string;
  /** Just the drone. */
  shortName: string;
  /** The ways a customer can fly it, in the order they are offered; a drone that always comes with its own controller lists just that. */
  controllerOptions: readonly ControllerKind[];
  /** Prices or names that differ from CONTROLLER_PROFILES for this drone's own controller (the parked GT50's bundled one). */
  controllerOverrides?: Partial<Record<ControllerEquipment, Partial<Omit<ControllerProfile, "key">>>>;
  /** Letter its batteries are named with: B1, B2... for the Neo 2, N1, N2... for the Neo, A1, A2... for the GT50 (numbered per shop, see batteryNames.ts). */
  batteryPrefix: string;
  /** Per hour booked without a controller, and also the late fee per hour without one. */
  hourlyRateMyr: number;
  /** What one day costs (see DAILY_RENTAL below): phone only, and with the RC-N3. Null when this drone is only rented by the hour. */
  dailyRateMyr: { NONE: number; RC_N3: number } | null;
  /** What each battery choice costs, and also the price of swapping that many mid-rental. */
  batteryFeeMyr: Record<BatteryCount, number>;
  depositDroneMyr: number;
  /** Whether the merchant takes guided photos at handover and return. */
  photosRequired: boolean;
  /** The strongest wind it may be rented in, m/s: DJI's own wind resistance for the drone. Null when no limit is known (nothing is blocked). */
  maxWindMps: number | null;
  /** About how many minutes of flying each battery choice gives, ready to show; null when it isn't known, so nothing is claimed. */
  flightMinutes: Record<BatteryCount, string> | null;
};

export const DRONE_MODEL_PROFILES: Record<DroneModel, DroneModelProfile> = {
  NEO2: {
    key: "NEO2",
    name: "DJI Neo 2",
    shortName: "DJI Neo 2",
    controllerOptions: ["NONE", "RC_N3", "GOGGLES_N3"],
    batteryPrefix: "B",
    hourlyRateMyr: HOURLY_RATE_MYR,
    dailyRateMyr: { NONE: 98, RC_N3: 128 },
    batteryFeeMyr: BATTERY_PACKAGE_FEE_MYR,
    depositDroneMyr: 700,
    photosRequired: true,
    maxWindMps: 10.7, // Level 5
    flightMinutes: { 1: "12–15", 2: "25–30" },
  },
  NEO: {
    key: "NEO",
    name: "DJI Neo",
    shortName: "DJI Neo",
    controllerOptions: ["NONE", "RC_N3", "GOGGLES_N3"],
    batteryPrefix: "N",
    hourlyRateMyr: HOURLY_RATE_MYR - 1,
    dailyRateMyr: { NONE: 98, RC_N3: 128 },
    batteryFeeMyr: { 1: BATTERY_PACKAGE_FEE_MYR[1] - 1, 2: BATTERY_PACKAGE_FEE_MYR[2] - 1 },
    depositDroneMyr: 600,
    photosRequired: true,
    maxWindMps: 8, // Level 4, DJI's rating for the original Neo
    flightMinutes: { 1: "12–15", 2: "25–30" },
  },
  GT50: {
    key: "GT50",
    name: "GT50 + controller",
    shortName: "GT50",
    controllerOptions: ["RC_N3"],
    controllerOverrides: { RC_N3: { name: "Controller", shortName: "Controller", hourlyMyr: 0, depositMyr: 50 } },
    batteryPrefix: "A",
    hourlyRateMyr: 7,
    dailyRateMyr: null,
    batteryFeeMyr: { 1: 5, 2: 8 },
    depositDroneMyr: 100,
    photosRequired: true,
    maxWindMps: null,
    flightMinutes: null,
  },
};

/** The profile for a stored model value; anything unrecognised (or missing, on rows from before models existed) is the Neo 2. */
export function modelProfile(model: string | null | undefined): DroneModelProfile {
  return isDroneModel(model) ? DRONE_MODEL_PROFILES[model] : DRONE_MODEL_PROFILES[DEFAULT_DRONE_MODEL];
}

/**
 * The controller choice that actually applies to a rental: what was asked for if this drone offers it, otherwise the drone's first
 * option (a GT50 always comes with its own controller, whatever was asked for).
 */
export function effectiveController(model: string | null | undefined, controller: ControllerKind = DEFAULT_CONTROLLER): ControllerKind {
  const options = modelProfile(model).controllerOptions;
  return options.includes(controller) ? controller : options[0];
}

/** The key a booking combination's picture is looked up by: drone, how it is flown, batteries. */
export function comboKey(model: string, controller: string, batteries: number): string {
  return `${model}:${controller}:${batteries}`;
}

/** The controller choice stored on a booking or order row for this model; a missing or unrecognised value counts as the default (every older row had the RC-N3). */
export function storedController(model: string | null | undefined, kind: string | null | undefined): ControllerKind {
  return effectiveController(model, isControllerKind(kind) ? kind : DEFAULT_CONTROLLER);
}

/** Whether a controller goes out with this rental (as opposed to the customer flying from their own phone). */
export function includesController(model: string | null | undefined, controller: ControllerKind = DEFAULT_CONTROLLER): boolean {
  return effectiveController(model, controller) !== "NONE";
}

/** The controller's name, price and deposit for this drone, or null when no controller is rented. */
export function controllerProfileFor(model: string | null | undefined, controller: ControllerKind = DEFAULT_CONTROLLER): ControllerProfile | null {
  const kind = effectiveController(model, controller);
  if (kind === "NONE") return null;
  return { ...CONTROLLER_PROFILES[kind], ...modelProfile(model).controllerOverrides?.[kind] };
}

/** What the customer sees for the choice: "Phone only" or the controller's name. */
export function controllerLabel(model: string | null | undefined, controller: ControllerKind = DEFAULT_CONTROLLER): string {
  return controllerProfileFor(model, controller)?.shortName ?? "Phone only";
}

/** The price per hour, and the late fee per hour: the drone's rate, plus the controller's when one is rented. */
export function hourlyRateFor(model: string | null | undefined, controller: ControllerKind = DEFAULT_CONTROLLER): number {
  return modelProfile(model).hourlyRateMyr + (controllerProfileFor(model, controller)?.hourlyMyr ?? 0);
}

/** What is held for the controller alone (0 when none is rented). */
export function controllerDepositFor(model: string | null | undefined, controller: ControllerKind = DEFAULT_CONTROLLER): number {
  return controllerProfileFor(model, controller)?.depositMyr ?? 0;
}

/** Total deposit hold for a model: the drone, plus the controller when one goes out too. */
export function depositMyrFor(model: string | null | undefined, controller: ControllerKind = DEFAULT_CONTROLLER): number {
  return modelProfile(model).depositDroneMyr + controllerDepositFor(model, controller);
}

/** A customer can hold at most this many batteries at once — swapping in one more requires returning one first. */
export const MAX_BATTERIES_HELD = 2;


/**
 * (The DJI Neo 2's figures; each model's own are in DRONE_MODEL_PROFILES.)
 * The deposit is a card hold sized to what's actually handed over: the
 * drone and the controller are each held for their own replacement value.
 * (The batteries aren't part of it — they're charged and kept at the shop.)
 */
export const DEPOSIT_DRONE_MYR = DRONE_MODEL_PROFILES.NEO2.depositDroneMyr; // drone only; the controller's is on top
export const DEPOSIT_CONTROLLER_MYR = CONTROLLER_PROFILES.RC_N3.depositMyr;
export const DEPOSIT_MYR = DEPOSIT_DRONE_MYR + DEPOSIT_CONTROLLER_MYR;

/** About how long one full battery flies (same figure the hotel-locker flow tells customers). Shown so nobody thinks a 2-hour rental means 2 hours in the air. */
export const BATTERY_FLIGHT_MINUTES_MIN = 12;
export const BATTERY_FLIGHT_MINUTES_MAX = 15;

/** The same figures for what a customer actually starts with, ready to show: 1 battery ~12–15 min, 2 batteries ~25–30 min. */
export const BATTERY_FLIGHT_LABEL: Record<BatteryCount, string> = { 1: "12–15", 2: "25–30" };

/** "RM1,300" — thousands separator so a four-digit deposit stays readable; "RM176.40" when there are cents. */
export function formatMyr(amount: number): string {
  // Whole amounts have no cents (RM98), and an amount with cents always shows two (RM176.40, not RM176.4).
  return `RM${amount.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** The lengths an online customer can book by the hour: whole hours, 1 to 6. Checked on the server too, since a form can be posted with anything. */
export const MIN_RENTAL_HOURS = 1;
export const MAX_RENTAL_HOURS = 6;

/**
 * Renting by the day instead of the hour. A day is 24 hours from the pickup time (picked up at 10:00, back by 10:00 the next day, 10:00
 * two days on...), 1 to 3 days. It comes with 3 batteries and a charger, so there is no battery choice and nothing to add for them.
 * Each day is the drone's daily rate (see dailyRateMyr in DRONE_MODEL_PROFILES: RM98 phone only, RM128 with the RC-N3; the goggles set is
 * hourly only), and the whole booking gets 10% off for every extra day: 2 days is 10% off, 3 days 20% off. The deposit is the same as
 * for an hourly rental and a late return is still billed by the hour.
 *
 * Whether a booking is hourly or daily is not stored on it: a length of a whole number of days is daily, and an hourly rental is never longer than 6 hours.
 */
export const DAY_MINUTES = 24 * 60;
export const MAX_RENTAL_DAYS = 3;
export const DAILY_BATTERIES = 3;
export const MULTI_DAY_DISCOUNT_PERCENT = 10;

/** Whether this length is a daily rental: a whole number of days, 1 to MAX_RENTAL_DAYS. */
export function isDailyMinutes(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= DAY_MINUTES && minutes <= MAX_RENTAL_DAYS * DAY_MINUTES && minutes % DAY_MINUTES === 0;
}

export function rentalDays(minutes: number): number {
  return Math.round(minutes / DAY_MINUTES);
}

/** Whether a stored booking is a daily rental: only a daily rental goes out with 3 batteries (an hourly one never has more than 2). */
export function isDailyBooking(booking: { batteries_count: number }): boolean {
  return booking.batteries_count === DAILY_BATTERIES;
}

/** How many batteries go out with a rental of this length: the chosen ones by the hour, always 3 by the day. */
export function batteriesFor(minutes: number, chosen: BatteryCount): number {
  return isDailyMinutes(minutes) ? DAILY_BATTERIES : chosen;
}

/** Whether a drone can be rented by the day with this way of flying: phone only or the RC-N3, never the goggles set. Null when the drone has no daily rate. */
export function dailyRateFor(model: string | null | undefined, controller: ControllerKind = DEFAULT_CONTROLLER): number | null {
  const rates = modelProfile(model).dailyRateMyr;
  if (!rates) return null;
  const kind = effectiveController(model, controller);
  return kind === "NONE" || kind === "RC_N3" ? rates[kind] : null;
}

/** Whether this drone with this way of flying has a daily rate at all (whether or not renting by the day is switched on). */
export function hasDailyRate(model: string | null | undefined, controller: ControllerKind = DEFAULT_CONTROLLER): boolean {
  return dailyRateFor(model, controller) !== null;
}

/** Whether a customer can rent this drone by the day with this way of flying right now: it has a daily rate and renting by the day is switched on (DAILY_RENTAL_ENABLED in lib/features.ts). */
export function offersDaily(model: string | null | undefined, controller: ControllerKind = DEFAULT_CONTROLLER): boolean {
  return DAILY_RENTAL_ENABLED && hasDailyRate(model, controller);
}

const round2Fee = (n: number) => Math.round(n * 100) / 100;

/** The whole price of a daily rental: every day at the daily rate, less 10% for every extra day (2 days -10%, 3 days -20%). Null when this drone and way of flying has no daily rate. */
export function dailyFeeMyr(days: number, model: string | null | undefined, controller: ControllerKind = DEFAULT_CONTROLLER): number | null {
  const perDay = dailyRateFor(model, controller);
  if (perDay === null || !Number.isInteger(days) || days < 1) return null;
  return round2Fee(days * perDay * (1 - ((days - 1) * MULTI_DAY_DISCOUNT_PERCENT) / 100));
}

/** What the extra days save, in ringgit, against paying the full daily rate for each. */
export function dailySavingMyr(days: number, model: string | null | undefined, controller: ControllerKind = DEFAULT_CONTROLLER): number {
  const perDay = dailyRateFor(model, controller);
  const fee = dailyFeeMyr(days, model, controller);
  return perDay === null || fee === null ? 0 : round2Fee(days * perDay - fee);
}

export type DailyBreakdown = { days: number; perDayMyr: number; /** Every day at the full daily rate. */ fullMyr: number; percent: number; savingMyr: number; totalMyr: number };

/** How a multi-day price is made up, to show under the total: the days at the daily rate, the discount, the total. Null for an hourly rental, one day, or a drone with no daily rate (nothing to show). */
export function dailyBreakdown(minutes: number, model: string | null | undefined, controller: ControllerKind = DEFAULT_CONTROLLER): DailyBreakdown | null {
  if (!isDailyMinutes(minutes) || minutes < 2 * DAY_MINUTES) return null;
  const days = rentalDays(minutes);
  const perDay = dailyRateFor(model, controller);
  const total = dailyFeeMyr(days, model, controller);
  if (perDay === null || total === null) return null;
  return { days, perDayMyr: perDay, fullMyr: round2Fee(days * perDay), percent: (days - 1) * MULTI_DAY_DISCOUNT_PERCENT, savingMyr: dailySavingMyr(days, model, controller), totalMyr: total };
}

export function isValidRentalMinutes(minutes: number): boolean {
  if (isDailyMinutes(minutes)) return true;
  return Number.isInteger(minutes) && minutes % 60 === 0 && minutes >= MIN_RENTAL_HOURS * 60 && minutes <= MAX_RENTAL_HOURS * 60;
}

/**
 * Rental fee. By the hour: the model's hourly rate for every hour (a partial hour counts as a full one) plus the price of the chosen batteries.
 * By the day (a whole number of days): the daily price, with the batteries included.
 */
export function rentalFeeMyr(
  durationMinutes: number,
  batteries: BatteryCount = DEFAULT_BATTERIES,
  model: string | null | undefined = DEFAULT_DRONE_MODEL,
  controller: ControllerKind = DEFAULT_CONTROLLER,
): number {
  if (isDailyMinutes(durationMinutes)) {
    const daily = dailyFeeMyr(rentalDays(durationMinutes), model, controller);
    if (daily !== null) return daily;
  }
  const hours = Math.ceil(durationMinutes / 60);
  if (hours <= 0) return 0;
  const profile = modelProfile(model);
  return hours * hourlyRateFor(model, controller) + profile.batteryFeeMyr[batteries];
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
 * it's lost, and whatever damage amount was assessed if it's damaged, up to
 * `capMyr` (the item's own deposit unless a bigger limit is given).
 */
export function itemCaptureMyr(itemName: string, itemValueMyr: number, item: ItemReturn, capMyr: number = itemValueMyr): number {
  if (item.outcome === "NONE") return 0;
  if (item.outcome === "LOST") return itemValueMyr;

  const damage = item.damageMyr;
  if (damage === undefined || !Number.isFinite(damage) || damage <= 0) {
    throw new DepositCaptureError(`Enter the damage charge for the ${itemName}.`);
  }
  return round2(Math.min(damage, capMyr));
}

/**
 * Total to capture from the held deposit; whatever isn't captured is released back to the customer. The limit is the whole
 * deposit held (drone plus controller): if the damage costs more than that, the whole deposit is taken and ProCam absorbs the
 * rest. A lost item is always kept in full first; a damaged item's amount is cut back to fit what is left.
 */
export function computeDepositCapture(
  drone: ItemReturn,
  controller: ItemReturn,
  model: string | null | undefined = DEFAULT_DRONE_MODEL,
  rented: ControllerKind = DEFAULT_CONTROLLER,
): DepositCapture {
  const profile = modelProfile(model);
  // A rental without a controller has nothing held for it, so whatever is said about it counts for nothing.
  const controllerItem: ItemReturn = includesController(model, rented) ? controller : { outcome: "NONE" };
  const heldMyr = profile.depositDroneMyr + (includesController(model, rented) ? controllerDepositFor(model, rented) : 0);
  let droneChargeMyr = itemCaptureMyr("drone", profile.depositDroneMyr, drone, heldMyr);
  let controllerChargeMyr = itemCaptureMyr(controllerProfileFor(model, rented)?.name ?? "controller", controllerDepositFor(model, rented), controllerItem, heldMyr);
  let excess = round2(droneChargeMyr + controllerChargeMyr - heldMyr);
  if (excess > 0) {
    if (drone.outcome === "DAMAGED") {
      const cut = Math.min(excess, droneChargeMyr);
      droneChargeMyr = round2(droneChargeMyr - cut);
      excess = round2(excess - cut);
    }
    if (excess > 0 && controllerItem.outcome === "DAMAGED") controllerChargeMyr = round2(controllerChargeMyr - Math.min(excess, controllerChargeMyr));
  }
  const outcomes = [drone.outcome, controllerItem.outcome];
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
export function lateFeeMyr(minutesLate: number, model: string | null | undefined = DEFAULT_DRONE_MODEL, controller: ControllerKind = DEFAULT_CONTROLLER): number {
  if (minutesLate <= 0) return 0;
  return Math.ceil(minutesLate / 60) * hourlyRateFor(model, controller);
}

/**
 * Single source of truth for the drone rental vertical's pricing/scheduling
 * constants. Flat constants rather than an admin-editable table (unlike
 * ProCam's rental_packages) — the vertical rents two DJI drones (the Neo 2 and the older Neo) with one rate plan
 * each, so there's no tier grid to make editable yet.
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
  RC_N3: { key: "RC_N3", name: "RC-N3 controller", shortName: "RC-N3", hourlyMyr: 5, depositMyr: 400 },
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
export function rentalFeeMyr(
  durationMinutes: number,
  batteries: BatteryCount = DEFAULT_BATTERIES,
  model: string | null | undefined = DEFAULT_DRONE_MODEL,
  controller: ControllerKind = DEFAULT_CONTROLLER,
): number {
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
export function computeDepositCapture(
  drone: ItemReturn,
  controller: ItemReturn,
  model: string | null | undefined = DEFAULT_DRONE_MODEL,
  rented: ControllerKind = DEFAULT_CONTROLLER,
): DepositCapture {
  const profile = modelProfile(model);
  // A rental without a controller has nothing held for it, so whatever is said about it counts for nothing.
  const controllerItem: ItemReturn = includesController(model, rented) ? controller : { outcome: "NONE" };
  const droneChargeMyr = itemCaptureMyr("drone", profile.depositDroneMyr, drone);
  const controllerChargeMyr = itemCaptureMyr(controllerProfileFor(model, rented)?.name ?? "controller", controllerDepositFor(model, rented), controllerItem);
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

import { ONLINE_MAX_HOURS } from "@/lib/legal";
import { DRONE_MODEL_PROFILES, ENABLED_DRONE_MODELS, isBatteryCount, isControllerKind, isDroneModel, type BatteryCount, type ControllerKind, type DroneModel } from "./pricingRules";

/**
 * A package the visitor picked on the landing page before choosing a shop: the drone, how they fly it, how many batteries and for
 * how long. It travels in the address (`?drone=NEO2&fly=RC_N3&batteries=2&hours=3`) through the shop list to the booking page,
 * which starts at the times with it already filled in. Anything that is not a real combination is ignored.
 */
export type PackagePreset = { model: DroneModel; controller: ControllerKind; batteries: BatteryCount; hours: number };

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parsePackagePreset(params: Params): PackagePreset | null {
  const model = first(params.drone);
  const fly = first(params.fly);
  const batteries = Number(first(params.batteries));
  const hours = Number(first(params.hours));
  if (!isDroneModel(model) || !(ENABLED_DRONE_MODELS as readonly string[]).includes(model)) return null;
  if (!isControllerKind(fly) || !DRONE_MODEL_PROFILES[model].controllerOptions.includes(fly)) return null;
  if (!isBatteryCount(batteries)) return null;
  if (!Number.isInteger(hours) || hours < 1 || hours > ONLINE_MAX_HOURS) return null;
  return { model, controller: fly, batteries, hours };
}

/** The address query for a package, without the leading "?". */
export function packageQuery(p: PackagePreset): string {
  return `drone=${p.model}&fly=${p.controller}&batteries=${p.batteries}&hours=${p.hours}`;
}

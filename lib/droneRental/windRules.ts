/**
 * Wind limits for flying: pure rules (no network), so they can be tested. The live numbers come from lib/droneRental/wind.ts.
 *
 * A drone can't be rented for a time when the wind there is stronger than the drone can fly in. The limit is each model's own
 * wind resistance from DJI (see maxWindMps in pricingRules.ts): 10.7 m/s for the Neo 2 and 8 m/s for the Neo.
 */

import { modelProfile } from "./pricingRules";

/** One hour of forecast: the wind speed (m/s, steady wind at 10 m) for the hour starting at `start`. */
export type HourlyWind = { start: Date; windMps: number };

export type WindForecast = {
  /** The wind right now, m/s. */
  currentMps: number | null;
  hours: HourlyWind[];
};

const HOUR_MS = 3_600_000;

/** The strongest wind this drone may be rented in, m/s; null when no limit is known for it. */
export function windLimitFor(model: string | null | undefined): number | null {
  return modelProfile(model).maxWindMps;
}

/** Whether `windMps` is too strong for the drone. Exactly at the limit is still fine ("more than 10.7 m/s" is the cut-off). */
export function isTooWindy(model: string | null | undefined, windMps: number | null): boolean {
  const limit = windLimitFor(model);
  return limit !== null && windMps !== null && windMps > limit;
}

/**
 * The strongest wind expected between `start` and `end`: every forecast hour that overlaps the rental, and the live reading
 * too when the rental is under way right now (it is more up to date than the hour's forecast). Null when there is nothing to
 * go on, which callers treat as "don't block" so a weather outage never stops the shop renting.
 */
export function maxWindForWindow(forecast: WindForecast, start: Date, end: Date, now: Date = new Date()): number | null {
  const values: number[] = [];
  for (const h of forecast.hours) {
    const hourEnd = h.start.getTime() + HOUR_MS;
    if (h.start.getTime() < end.getTime() && hourEnd > start.getTime()) values.push(h.windMps);
  }
  const underway = start.getTime() <= now.getTime() + 60_000 && end.getTime() > now.getTime();
  if (underway && forecast.currentMps !== null) values.push(forecast.currentMps);
  return values.length ? Math.max(...values) : null;
}

/** "10.7" / "8": a wind speed for a message, one decimal at most. */
export function formatWind(mps: number): string {
  return `${Math.round(mps * 10) / 10} m/s`;
}

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isTooWindy, maxWindForWindow, windLimitFor, type WindForecast } from "./windRules";

/** How long a forecast is reused before asking again: wind doesn't change that fast, and every booking page load would otherwise hit the weather service. */
const FORECAST_CACHE_SECONDS = 600;

/**
 * The wind forecast for a place, from Open-Meteo (free, no key): the steady wind speed at 10 m in m/s, now and for each hour of the
 * next three days. Returns null when the service can't be reached, and callers then don't block anything: a weather outage
 * shouldn't stop the shop renting.
 */
export async function getWindForecast(lat: number, lng: number): Promise<WindForecast | null> {
  // Rounded so shops a few metres apart share one cached answer.
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}` +
    `&current=wind_speed_10m&hourly=wind_speed_10m&wind_speed_unit=ms&timezone=UTC&forecast_days=3`;
  try {
    const res = await fetch(url, { next: { revalidate: FORECAST_CACHE_SECONDS }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      current?: { wind_speed_10m?: number };
      hourly?: { time?: string[]; wind_speed_10m?: (number | null)[] };
    };
    const times = body.hourly?.time ?? [];
    const speeds = body.hourly?.wind_speed_10m ?? [];
    return {
      currentMps: typeof body.current?.wind_speed_10m === "number" ? body.current.wind_speed_10m : null,
      // Times come back as "2026-10-07T07:00" in UTC because the request asks for it.
      hours: times.flatMap((t, i) => (typeof speeds[i] === "number" ? [{ start: new Date(`${t}:00Z`), windMps: speeds[i] as number }] : [])),
    };
  } catch {
    return null;
  }
}

export type WindCheck = {
  /** The strongest wind expected in the window, m/s; null when the forecast couldn't be had. */
  windMps: number | null;
  /** The drone's limit in m/s; null when it has none. */
  limitMps: number | null;
  tooWindy: boolean;
};

/** The forecast for a shop, looked up from its map position. */
export async function getShopWindForecast(shopId: string): Promise<WindForecast | null> {
  const supabase = createServiceRoleClient();
  const { data: shop } = await supabase.from("dr_shops").select("lat,lng").eq("id", shopId).maybeSingle();
  return shop ? getWindForecast(shop.lat, shop.lng) : null;
}

/** Is it too windy at this shop for this drone between `start` and `end`? */
export async function checkWind(shopId: string, model: string, start: Date, end: Date): Promise<WindCheck> {
  const limitMps = windLimitFor(model);
  if (limitMps === null) return { windMps: null, limitMps, tooWindy: false };
  const forecast = await getShopWindForecast(shopId);
  const windMps = forecast ? maxWindForWindow(forecast, start, end) : null;
  return { windMps, limitMps, tooWindy: isTooWindy(model, windMps) };
}

import { DRONE_ID_CHECK_ENABLED } from "@/lib/features";

/** The steps of the drone booking flow, in order, for the drop-off funnel (Admin > Drone Funnel). Shared by the browser and the admin page. */
export const DRONE_FUNNEL_STEPS = [
  { key: "HOME", label: "Home page" },
  { key: "PRICE", label: "Picked a package on the home page" },
  { key: "SHOPS", label: "Shop list" },
  { key: "PACKAGE", label: "Booking page: drone, how to fly, batteries" },
  { key: "TIME", label: "Booking page: day and time" },
  { key: "DETAILS", label: "Booking page: their details" },
  { key: "ID_CHECK", label: DRONE_ID_CHECK_ENABLED ? "Tapped Book and pay (ID check starts)" : "Tapped Book and pay" },
  { key: "PAY", label: "Payment page" },
  { key: "PAID", label: "Paid" },
] as const;

export type DroneFunnelStep = (typeof DRONE_FUNNEL_STEPS)[number]["key"];
export const DRONE_FUNNEL_KEYS: readonly string[] = DRONE_FUNNEL_STEPS.map((s) => s.key);
/** The tab-only fallback id (see components/FunnelBeacon.tsx). */
export const FUNNEL_SESSION_KEY = "procam_funnel_sid";
/** The lasting id of this browser on this device: the funnel and the location traffic count a device once. */
export const DEVICE_ID_KEY = "procam_device_id";
export const FUNNEL_PAYING_KEY = "procam_funnel_paying";

/**
 * Visits that must never count in the funnel or the location traffic: anything on this computer's own address (the local copy of the site, which shares the live
 * database, so every test run and every look at a change would otherwise be counted), and automated browsers and bots (the headless Chrome the test runs
 * use, search-engine and preview crawlers), none of which are customers.
 */
export function isTestTraffic(host: string | null | undefined, userAgent: string | null | undefined): boolean {
  const name = (host ?? "").toLowerCase().replace(/:\d+$/, "");
  if (name === "localhost" || name === "127.0.0.1" || name === "[::1]" || name.endsWith(".localhost")) return true;
  return /headless|puppeteer|playwright|selenium|webdriver|lighthouse|bot\b|crawler|spider|slurp|preview/i.test(userAgent ?? "");
}

/**
 * The country a visit came from as a two-letter code ("MY"), or null when it is not known. The hosting platform works it out from the connection and puts it in
 * a header (Vercel: x-vercel-ip-country; Cloudflare: cf-ipcountry); only that code is ever kept, never the address. XX and T1 are what some networks send
 * when they do not know, and count as unknown.
 */
export function countryFromHeaders(get: (name: string) => string | null | undefined): string | null {
  const raw = (get("x-vercel-ip-country") ?? get("cf-ipcountry") ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(raw) && raw !== "XX" && raw !== "T1" ? raw : null;
}

/** "Malaysia" for "MY" in English; the code itself when the browser has no name for it, and "Not known" for none. */
export function countryName(code: string | null | undefined): string {
  if (!code) return "Not known";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Devices by country from rows of (device id, country): a device is counted once, under the first country it was seen from (or "not known" when none was). Biggest first. */
export function devicesByCountry(rows: readonly { session_id: string; country: string | null }[]): { country: string | null; devices: Set<string> }[] {
  const of = new Map<string, string | null>();
  for (const r of rows) if (!of.has(r.session_id) || (of.get(r.session_id) === null && r.country)) of.set(r.session_id, r.country);
  const groups = new Map<string | null, Set<string>>();
  for (const [session, country] of of) {
    if (!groups.has(country)) groups.set(country, new Set());
    groups.get(country)!.add(session);
  }
  return [...groups.entries()]
    .map(([country, devices]) => ({ country, devices }))
    .sort((a, b) => (a.country === null ? 1 : b.country === null ? -1 : b.devices.size - a.devices.size || a.country.localeCompare(b.country)));
}

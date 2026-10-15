import { BATTERY_PACKAGE_FEE_MYR, HOURLY_RATE_MYR } from "./pricingRules";

/**
 * The numbers behind Admin > Drone Rental > Profit: what each rental costs to take (card fees, messages, battery wear), the 65% profit
 * target, and a day-by-day demand forecast for the one shop. Everything here is a plain assumption in one place, so changing a number
 * here changes the page. The forecast is a planning tool, not a promise: its conversion rate is an estimate until real bookings replace it.
 */

/** Stripe Malaysia, local cards: 3% + RM1 per charge. */
export const CARD_FEE_PCT = 0.03;
export const CARD_FEE_FIXED_MYR = 1;
/** WhatsApp utility message, roughly (Meta's price list for Malaysia); a rental sends about four. */
export const WHATSAPP_MYR_PER_MESSAGE = 0.08;
/** What one use of a battery costs in wear: its price divided by its charge cycles. An estimate until the real battery price is known. */
export const BATTERY_WEAR_MYR_PER_USE = 1.5;
/** Set aside from sales for damage the deposit doesn't cover; used in the forecast only (actual damage is already taken from deposits). */
export const DAMAGE_RESERVE_PCT = 0.03;
/** The profit the owner plans on: 65 of every 100 charged. */
export const TARGET_MARGIN = 0.65;
/** Prices of the kit besides the drones (whose cost is in the database). Null = not entered, so it isn't counted in payback. */
export const BATTERY_COST_MYR: number | null = null;
export const CONTROLLER_COST_MYR: number | null = null;

export function cardFeeMyr(chargeMyr: number): number {
  return chargeMyr > 0 ? chargeMyr * CARD_FEE_PCT + CARD_FEE_FIXED_MYR : 0;
}

// ---- Calendar -------------------------------------------------------------------------------------------------------------------------

/** Malaysia's 2026 public holidays that matter in Negeri Sembilan, and the Group B school holidays (Negeri Sembilan, Selangor, KL...). */
const PUBLIC_HOLIDAYS_2026 = ["2026-01-01", "2026-01-14", "2026-02-17", "2026-02-18", "2026-03-20", "2026-05-01", "2026-06-01", "2026-08-31", "2026-09-16", "2026-12-25"];
const SCHOOL_HOLIDAYS_2026: [string, string][] = [
  ["2026-03-21", "2026-03-29"],
  ["2026-05-23", "2026-06-07"],
  ["2026-08-29", "2026-09-06"],
  ["2026-12-05", "2026-12-31"],
];

export const DAY_TYPES = ["WEEKDAY", "HOLIDAY_WEEKDAY", "WEEKEND", "HOLIDAY_WEEKEND"] as const;
export type DayType = (typeof DAY_TYPES)[number];
export const DAY_TYPE_LABEL: Record<DayType, string> = {
  WEEKDAY: "Normal weekday",
  HOLIDAY_WEEKDAY: "Holiday weekday",
  WEEKEND: "Normal weekend",
  HOLIDAY_WEEKEND: "Holiday weekend",
};
/** How busy each kind of day is compared with a normal weekday (an assumption). */
const DAY_TYPE_WEIGHT: Record<DayType, number> = { WEEKDAY: 1, HOLIDAY_WEEKDAY: 1.8, WEEKEND: 2.2, HOLIDAY_WEEKEND: 3 };

/** The kind of day a calendar date (yyyy-mm-dd, Malaysia time) is. Only 2026's holidays are known, so other years count weekends and weekdays only. */
export function dayTypeOf(ymd: string): DayType {
  const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  const school = SCHOOL_HOLIDAYS_2026.some(([a, b]) => ymd >= a && ymd <= b);
  if (dow === 0 || dow === 6) return school ? "HOLIDAY_WEEKEND" : "WEEKEND";
  return school || PUBLIC_HOLIDAYS_2026.includes(ymd) ? "HOLIDAY_WEEKDAY" : "WEEKDAY";
}

export function ymdList(year: number): string[] {
  const out: string[] = [];
  for (let d = Date.UTC(year, 0, 1); new Date(d).getUTCFullYear() === year; d += 86_400_000) out.push(new Date(d).toISOString().slice(0, 10));
  return out;
}

// ---- Forecast -------------------------------------------------------------------------------------------------------------------------

/** Port Dickson tourist arrivals a year (about 4.2 million in the district officer's figure, older years 4.5 to 5.5 million). */
export const PORT_DICKSON_ARRIVALS_PER_YEAR = 4_200_000;
/** Share of those visitors who rent a drone. Nobody publishes this: it is an estimate, so the forecast shows a low, a base and a high case. */
export const BASE_CONVERSION = 0.0003;
/** About 3 days in 10 are too rainy to fly, losing 60% of that day's demand. */
export const WEATHER_FACTOR = 1 - 0.3 * 0.6;
export const SCENARIOS = [
  { key: "LOW", label: "Low", multiplier: 0.5 },
  { key: "BASE", label: "Base", multiplier: 1 },
  { key: "HIGH", label: "High", multiplier: 2 },
] as const;
export type ScenarioKey = (typeof SCENARIOS)[number]["key"];

/** What an average rental brings in: two hours, with 2 batteries 6 times in 10 and 1 battery 4 times in 10. */
export function averageTicketMyr(): number {
  return 2 * HOURLY_RATE_MYR + 0.6 * BATTERY_PACKAGE_FEE_MYR[2] + 0.4 * BATTERY_PACKAGE_FEE_MYR[1];
}

export type DayForecast = { type: DayType; days: number; arrivals: number; rentals: number; salesMyr: number; profitMyr: number };

/** Rentals, sales and planned profit (at the 65% target) for one day of each type, and how many such days the year has. */
export function forecastByDayType(year: number, scenario: ScenarioKey = "BASE"): DayForecast[] {
  const multiplier = SCENARIOS.find((s) => s.key === scenario)!.multiplier;
  const counts: Record<DayType, number> = { WEEKDAY: 0, HOLIDAY_WEEKDAY: 0, WEEKEND: 0, HOLIDAY_WEEKEND: 0 };
  for (const ymd of ymdList(year)) counts[dayTypeOf(ymd)] += 1;
  const index = DAY_TYPES.reduce((s, t) => s + counts[t] * DAY_TYPE_WEIGHT[t], 0);
  const weekdayArrivals = PORT_DICKSON_ARRIVALS_PER_YEAR / index;
  return DAY_TYPES.map((type) => {
    const arrivals = weekdayArrivals * DAY_TYPE_WEIGHT[type];
    const rentals = arrivals * BASE_CONVERSION * multiplier * WEATHER_FACTOR;
    const salesMyr = rentals * averageTicketMyr();
    return { type, days: counts[type], arrivals, rentals, salesMyr, profitMyr: salesMyr * TARGET_MARGIN };
  });
}

/** Forecast sales for each month (index 0 = January) of the year. */
export function forecastMonthlySales(year: number, scenario: ScenarioKey = "BASE"): number[] {
  const perDay = new Map(forecastByDayType(year, scenario).map((f) => [f.type, f.salesMyr]));
  const months = Array<number>(12).fill(0);
  for (const ymd of ymdList(year)) months[Number(ymd.slice(5, 7)) - 1] += perDay.get(dayTypeOf(ymd)) ?? 0;
  return months;
}

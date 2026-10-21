/**
 * Shop opening hours and the customer-facing slot grid, always in Malaysia
 * time (UTC+8, no daylight saving) — never the visitor's own timezone, since
 * a traveller's phone can be set to anywhere. Pure functions so the booking
 * page and the server action share exactly one definition of "open".
 *
 * Each shop has its own hours, set by the admin: a different opening and closing time for each weekday, or closed for the day
 * (`ShopHours`, stored in dr_shops.hours). A shop with none set keeps the old default, 08:00 to 22:00 every day. A rental must
 * END by closing time: a drone due back after the shop has shut can't be returned.
 */
export const OPERATING_HOUR_START = 8;
export const OPERATING_HOUR_END = 22;
export const SLOT_MINUTES = 30;

const MYT_OFFSET_MS = 8 * 60 * 60_000;

/** One day: "09:00" to "18:00" (on the half hour), or null when the shop is closed that day. */
export type DayHours = { open: string; close: string } | null;
/** Seven entries, Sunday first (0) to Saturday (6). */
export type ShopHours = DayHours[];

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pad = (n: number) => String(n).padStart(2, "0");
export const DEFAULT_DAY_HOURS: { open: string; close: string } = { open: `${pad(OPERATING_HOUR_START)}:00`, close: `${pad(OPERATING_HOUR_END)}:00` };
export const DEFAULT_SHOP_HOURS: ShopHours = Array.from({ length: 7 }, () => ({ ...DEFAULT_DAY_HOURS }));

const TIME = /^([01]\d|2[0-3]):(00|30)$/;
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Whether this is a valid "HH:MM" on the half hour. */
export function isHalfHourTime(value: unknown): value is string {
  return typeof value === "string" && TIME.test(value);
}

/**
 * The hours stored for a shop (dr_shops.hours), or the default when nothing valid is stored. Accepts the stored JSON: a list of 7
 * entries, each null (closed) or [open, close]; an entry that is not valid or has closing before opening falls back to the default
 * for that day, so a bad value can never lock customers out by accident.
 */
export function parseShopHours(raw: unknown): ShopHours {
  if (!Array.isArray(raw) || raw.length !== 7) return DEFAULT_SHOP_HOURS;
  return raw.map((day): DayHours => {
    if (day === null) return null;
    if (Array.isArray(day) && isHalfHourTime(day[0]) && isHalfHourTime(day[1]) && minutesOf(day[0]) < minutesOf(day[1])) return { open: day[0], close: day[1] };
    return { ...DEFAULT_DAY_HOURS };
  });
}

/** What is stored for a shop: the shape parseShopHours reads back. */
export function serializeShopHours(hours: ShopHours): (string[] | null)[] {
  return hours.map((d) => (d ? [d.open, d.close] : null));
}

/** The Malaysia weekday (0 Sunday to 6 Saturday) of an instant. */
export function malaysiaWeekday(date: Date): number {
  return new Date(date.getTime() + MYT_OFFSET_MS).getUTCDay();
}

/** The instant at `hhmm` Malaysia time on the Malaysia calendar day that `date` falls on. */
function mytTimeOnDayOf(date: Date, hhmm: string): Date {
  const shifted = new Date(date.getTime() + MYT_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), Number(hhmm.slice(0, 2)), Number(hhmm.slice(3, 5))) - MYT_OFFSET_MS);
}

/** When the shop opens on the Malaysia day of `date`; null if it is closed that day. Without `hours` it is the default 08:00. */
export function shopOpensAt(date: Date): Date;
export function shopOpensAt(date: Date, hours: ShopHours): Date | null;
export function shopOpensAt(date: Date, hours: ShopHours = DEFAULT_SHOP_HOURS): Date | null {
  const day = hours[malaysiaWeekday(date)];
  return day ? mytTimeOnDayOf(date, day.open) : null;
}

/** When the shop closes on the Malaysia day of `date`; null if it is closed that day. Without `hours` it is the default 22:00. */
export function shopClosesAt(date: Date): Date;
export function shopClosesAt(date: Date, hours: ShopHours): Date | null;
export function shopClosesAt(date: Date, hours: ShopHours = DEFAULT_SHOP_HOURS): Date | null {
  const day = hours[malaysiaWeekday(date)];
  return day ? mytTimeOnDayOf(date, day.close) : null;
}

/** A rental this long or longer is by the day: it is picked up on one day and brought back on another, at the same time of day. */
const MULTI_DAY_MINUTES = 24 * 60;

/**
 * Whether a rental of `durationMinutes` starting at `start` can happen. By the hour it begins after opening and ends by closing, on one Malaysia day.
 * By the day it is picked up while the shop is open (before closing) and brought back at the same time of day on the last day, which has to be
 * a day the shop is open at that time too: a drone can't be returned to a closed shop.
 */
export function isWithinOperatingHours(start: Date, durationMinutes: number, hours: ShopHours = DEFAULT_SHOP_HOURS): boolean {
  const open = shopOpensAt(start, hours);
  const close = shopClosesAt(start, hours);
  if (!open || !close) return false;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  if (durationMinutes < MULTI_DAY_MINUTES) return start >= open && end <= close;
  const openEnd = shopOpensAt(end, hours);
  const closeEnd = shopClosesAt(end, hours);
  return start >= open && start < close && !!openEnd && !!closeEnd && end >= openEnd && end <= closeEnd;
}

/** Whether the shop is open at this moment. */
export function isOpenNow(hours: ShopHours, now: Date = new Date()): boolean {
  const open = shopOpensAt(now, hours);
  const close = shopClosesAt(now, hours);
  return !!open && !!close && now >= open && now < close;
}

/** "09:00 to 18:00", or "Closed", for the Malaysia day of `date`. */
export function describeDayHours(hours: ShopHours, date: Date): string {
  const day = hours[malaysiaWeekday(date)];
  return day ? `${day.open} to ${day.close}` : "Closed";
}

function ceilToSlot(date: Date): Date {
  const ms = SLOT_MINUTES * 60_000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

/**
 * Candidate start times for the Malaysia day `dayOffset` days after today's:
 * every 30 minutes from opening (or the next slot from `now`, for today) up
 * to the last start whose rental still ends by closing. Empty when the shop is
 * closed that day, or the day is already over for this duration.
 */
export function generateDaySlots(now: Date, dayOffset: number, durationMinutes: number, hours: ShopHours = DEFAULT_SHOP_HOURS): Date[] {
  const day = new Date(now.getTime() + dayOffset * 24 * 60 * 60_000);
  const open = shopOpensAt(day, hours);
  const close = shopClosesAt(day, hours);
  if (!open || !close) return [];
  const first = dayOffset === 0 && now > open ? ceilToSlot(now) : open;
  // By the day the pickup can be any time the shop is open (the last half hour before closing included), as long as the shop is open
  // at the same time on the day it comes back.
  const byTheDay = durationMinutes >= MULTI_DAY_MINUTES;
  const lastStart = byTheDay ? new Date(close.getTime() - SLOT_MINUTES * 60_000) : new Date(close.getTime() - durationMinutes * 60_000);

  const slots: Date[] = [];
  for (let t = first; t <= lastStart; t = new Date(t.getTime() + SLOT_MINUTES * 60_000)) {
    if (!byTheDay || isWithinOperatingHours(t, durationMinutes, hours)) slots.push(t);
  }
  return slots;
}

/** "Today", "Tomorrow", then "Mon 5 Oct" — labels for the day picker, in Malaysia time. */
export function dayLabel(now: Date, dayOffset: number): string {
  if (dayOffset === 0) return "Today";
  if (dayOffset === 1) return "Tomorrow";
  const day = new Date(now.getTime() + dayOffset * 24 * 60 * 60_000);
  return day.toLocaleDateString("en-GB", { timeZone: "Asia/Kuala_Lumpur", weekday: "short", day: "numeric", month: "short" });
}

/** "08:30" in Malaysia time. */
export function formatSlotTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit", hour12: false });
}

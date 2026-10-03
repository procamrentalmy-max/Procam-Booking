/**
 * Shop opening hours and the customer-facing slot grid, always in Malaysia
 * time (UTC+8, no daylight saving) — never the visitor's own timezone, since
 * a traveller's phone can be set to anywhere. Pure functions so the booking
 * page and the server action share exactly one definition of "open".
 *
 * Placeholder hours (no real opening hours were specified for this vertical):
 * every shop opens 08:00 and closes 22:00, and a rental must END by closing
 * time — a drone due back after the shop has shut can't be returned.
 */
export const OPERATING_HOUR_START = 8;
export const OPERATING_HOUR_END = 22;
export const SLOT_MINUTES = 30;

const MYT_OFFSET_MS = 8 * 60 * 60_000;

/** The instant at `hour`:00 Malaysia time on the Malaysia calendar day that `date` falls on. */
function mytHourOnDayOf(date: Date, hour: number): Date {
  const shifted = new Date(date.getTime() + MYT_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), hour) - MYT_OFFSET_MS);
}

export function shopOpensAt(date: Date): Date {
  return mytHourOnDayOf(date, OPERATING_HOUR_START);
}

export function shopClosesAt(date: Date): Date {
  return mytHourOnDayOf(date, OPERATING_HOUR_END);
}

/** Whether a rental of `durationMinutes` starting at `start` begins after opening and ends by closing, on one Malaysia day. */
export function isWithinOperatingHours(start: Date, durationMinutes: number): boolean {
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return start >= shopOpensAt(start) && end <= shopClosesAt(start);
}

function ceilToSlot(date: Date): Date {
  const ms = SLOT_MINUTES * 60_000;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

/**
 * Candidate start times for the Malaysia day `dayOffset` days after today's:
 * every 30 minutes from opening (or the next slot from `now`, for today) up
 * to the last start whose rental still ends by closing. Empty when the day
 * is already over for this duration.
 */
export function generateDaySlots(now: Date, dayOffset: number, durationMinutes: number): Date[] {
  const day = new Date(now.getTime() + dayOffset * 24 * 60 * 60_000);
  const open = shopOpensAt(day);
  const close = shopClosesAt(day);
  const first = dayOffset === 0 && now > open ? ceilToSlot(now) : open;
  const lastStart = new Date(close.getTime() - durationMinutes * 60_000);

  const slots: Date[] = [];
  for (let t = first; t <= lastStart; t = new Date(t.getTime() + SLOT_MINUTES * 60_000)) {
    slots.push(t);
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

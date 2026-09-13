/**
 * Numbered pickup slots at each hotel: a printed order gets handed the
 * highest currently-free slot (1..TOTAL_SLOTS), counting down from
 * TOTAL_SLOTS as the day's orders come in. A slot stays "occupied" for as
 * long as its order sits at status DELIVERED — once that order expires
 * (destroy_by passed, see the housekeeping cron, at which point it's moved
 * into the wooden box) the number is free again, which is what naturally
 * resets the count back to TOTAL_SLOTS for the next round rather than
 * needing an explicit "round" concept at all.
 */
export const TOTAL_SLOTS = 50;

export function nextAvailableSlot(occupied: ReadonlySet<number>): number | null {
  for (let n = TOTAL_SLOTS; n >= 1; n--) {
    if (!occupied.has(n)) return n;
  }
  return null;
}

const MYT_OFFSET_MINUTES = 8 * 60;

function mytDateParts(date: Date): { year: number; month: number; day: number } {
  const mytMs = date.getTime() + MYT_OFFSET_MINUTES * 60_000;
  const shifted = new Date(mytMs);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate() };
}

function mytWallClockToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month, day, hour - 8, minute));
}

/** 10:30am Malaysia time, same calendar day the order was placed in its slot. */
export function computeCollectBy(placedAt: Date): Date {
  const { year, month, day } = mytDateParts(placedAt);
  return mytWallClockToUtc(year, month, day, 10, 30);
}

const HOURS_UNTIL_BOXED = 24;

/** Exactly 24 hours after the order was placed in its slot -- past this, it's moved into the wooden box and the slot frees up. */
export function computeDestroyBy(placedAt: Date): Date {
  return new Date(placedAt.getTime() + HOURS_UNTIL_BOXED * 60 * 60_000);
}

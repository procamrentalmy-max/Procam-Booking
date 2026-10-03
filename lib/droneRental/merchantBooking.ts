import { TERMINAL_BOOKING_STATUSES, alignToNextInterval, type BookingWindow, type DroneCandidate } from "./slots";

/**
 * Merchant "instant" bookings are for walk-ins at the shop — they start
 * right now, with no slot picker. The only question is how long the
 * merchant can offer: if the drone already has an online booking starting
 * within the next hour, it's off the table entirely (too tight to safely
 * hand off, clean up, and hand off again); otherwise the merchant can book
 * up to whatever whole-hour duration still leaves a 30-minute buffer before
 * that next booking.
 */
export const MERCHANT_MIN_LEAD_BLOCK_MINUTES = 60;

/** Same return buffer the online slot engine uses (see slots.ts) — a walk-in still needs this much room before the next booking. */
export const MERCHANT_BUFFER_MINUTES = 30;

/** Whole-hour durations offered for a walk-in — merchant bookings aren't picked off the 30-minute grid the way online ones are. */
export const MERCHANT_OFFERED_DURATIONS_HOURS = [1, 2, 3, 4] as const;

export type MerchantInstantOptions =
  | { allowed: false; reason: "UPCOMING_BOOKING_TOO_SOON"; nextBookingStart: Date }
  | { allowed: true; maxDurationMinutes: number; offeredDurationsMinutes: number[] };

/**
 * What durations (if any) a merchant can offer a walk-in for `droneId`
 * right now. Only looks at bookings for this one drone — the merchant
 * picked the drone (or it's the only one at the shop) before this is
 * called.
 */
export function computeMerchantInstantOptions(
  bookings: readonly BookingWindow[],
  droneId: string,
  now: Date
): MerchantInstantOptions {
  const upcoming = bookings
    .filter(
      (b) =>
        b.droneId === droneId &&
        !TERMINAL_BOOKING_STATUSES.includes(b.status) &&
        b.startTime.getTime() > now.getTime()
    )
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];

  const allOffered = MERCHANT_OFFERED_DURATIONS_HOURS.map((h) => h * 60);

  if (!upcoming) {
    return { allowed: true, maxDurationMinutes: allOffered[allOffered.length - 1], offeredDurationsMinutes: allOffered };
  }

  const minutesUntilNext = (upcoming.startTime.getTime() - now.getTime()) / 60_000;
  if (minutesUntilNext <= MERCHANT_MIN_LEAD_BLOCK_MINUTES) {
    return { allowed: false, reason: "UPCOMING_BOOKING_TOO_SOON", nextBookingStart: upcoming.startTime };
  }

  // The return time is rounded up to the next 30-minute mark at handover (see computeHandoverWindow), so a duration only
  // fits if that rounded return time still leaves the buffer before the next booking.
  const offered = allOffered.filter((m) => {
    const roundedReturn = alignToNextInterval(new Date(now.getTime() + m * 60_000));
    return roundedReturn.getTime() + MERCHANT_BUFFER_MINUTES * 60_000 <= upcoming.startTime.getTime();
  });

  if (offered.length === 0) {
    return { allowed: false, reason: "UPCOMING_BOOKING_TOO_SOON", nextBookingStart: upcoming.startTime };
  }

  return { allowed: true, maxDurationMinutes: offered[offered.length - 1], offeredDurationsMinutes: offered };
}

/**
 * The drones at a shop that can take a walk-in of exactly `durationMinutes` right now: available, not
 * still sitting under an earlier booking (e.g. an online booking whose start time has passed but hasn't been
 * collected yet), and with room before their next booking (see computeMerchantInstantOptions). Sorted by
 * drone id so "the first one" is predictable.
 */
export function eligibleWalkInDrones(
  drones: readonly DroneCandidate[],
  bookings: readonly BookingWindow[],
  durationMinutes: number,
  now: Date
): DroneCandidate[] {
  return drones
    .filter((d) => d.status === "AVAILABLE")
    .filter((d) => {
      const occupied = bookings.some(
        (b) =>
          b.droneId === d.id &&
          !TERMINAL_BOOKING_STATUSES.includes(b.status) &&
          b.startTime.getTime() <= now.getTime() &&
          b.endTime.getTime() + MERCHANT_BUFFER_MINUTES * 60_000 > now.getTime()
      );
      if (occupied) return false;
      const options = computeMerchantInstantOptions(bookings, d.id, now);
      return options.allowed && options.offeredDurationsMinutes.includes(durationMinutes);
    })
    .sort((a, b) => a.humanId.localeCompare(b.humanId));
}

/** Every walk-in length (in minutes) at least one drone at the shop could take right now: what a customer scanning the shop's QR can choose from. */
export function walkInDurationsForShop(drones: readonly DroneCandidate[], bookings: readonly BookingWindow[], now: Date): number[] {
  return MERCHANT_OFFERED_DURATIONS_HOURS.map((h) => h * 60).filter((minutes) => eligibleWalkInDrones(drones, bookings, minutes, now).length > 0);
}

import { TERMINAL_BOOKING_STATUSES, alignToNextInterval, findEligibleDrone, type BookingWindow, type ControllerPool, type DroneCandidate } from "./slots";
import { DEFAULT_SHOP_HOURS, isWithinOperatingHours, type ShopHours } from "./hours";
import { DAY_MINUTES, MAX_RENTAL_DAYS, isDailyMinutes } from "./pricingRules";

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

/** Every length offered for a walk-in, in minutes: the whole hours, then 1 to 3 days (a daily rental, with 3 batteries and a charger). */
export const MERCHANT_OFFERED_DURATIONS_MINUTES: readonly number[] = [
  ...MERCHANT_OFFERED_DURATIONS_HOURS.map((h) => h * 60),
  ...Array.from({ length: MAX_RENTAL_DAYS }, (_, i) => (i + 1) * DAY_MINUTES),
];

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

  const allOffered = [...MERCHANT_OFFERED_DURATIONS_MINUTES];

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

/** How long after the paid time a walk-in's return can land: the handover comes a little after the order and the return time is rounded up to the half hour. */
const WALKIN_RETURN_MARGIN_MINUTES = 30;

/**
 * Every walk-in length (in minutes) at least one drone at the shop could take right now: what a customer scanning the shop's QR can choose from.
 * With a controller pool, a controller of that kind also has to be free for the whole length. A length of days is offered only if the shop is
 * open when the drone would come back (see isWithinOperatingHours), since a drone can't be returned to a closed shop.
 */
export function walkInDurationsForShop(
  drones: readonly DroneCandidate[],
  bookings: readonly BookingWindow[],
  now: Date,
  controllers: ControllerPool | null = null,
  hours: ShopHours = DEFAULT_SHOP_HOURS
): number[] {
  return MERCHANT_OFFERED_DURATIONS_MINUTES.filter(
    (minutes) =>
      (!isDailyMinutes(minutes) || isWithinOperatingHours(now, minutes + WALKIN_RETURN_MARGIN_MINUTES, hours)) &&
      eligibleWalkInDrones(drones, bookings, minutes, now).length > 0 &&
      (!controllers || findEligibleDrone(controllers.candidates, controllers.bookings, now, new Date(now.getTime() + minutes * 60_000)) !== null)
  );
}

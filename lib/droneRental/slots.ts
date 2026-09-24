/**
 * Drone rental slot/availability engine — the 30-minute-grid equivalent of
 * lib/locker-engine/feasibility.ts + bookingGate.ts, but deliberately
 * simpler: no worker routing, no minimum lead time (a customer can book to
 * start at the very next slot), and drones never change location, so
 * eligibility is pure per-shop inventory + a return buffer, nothing else.
 */

/** The slot table's granularity, and the grid every start time gets rounded up onto. */
export const SLOT_INTERVAL_MINUTES = 30;

/**
 * How long after a booking's scheduled end time the drone is treated as
 * ready for the next booking — covers both the customer running a little
 * late and the merchant's own handover time for the next renter. This is
 * added to the scheduled end, then the result is rounded up onto the slot
 * grid: a 6:01 scheduled return -> 6:31 -> next slot 7:00.
 */
export const RETURN_BUFFER_MINUTES = 30;

/**
 * Separate from the scheduling buffer above: how late a customer can bring
 * a drone back before the merchant treats the return as actually late (for
 * flagging/late-fee purposes elsewhere). Not used in next-slot math — a
 * return arriving anywhere inside this grace window still only frees the
 * drone once RETURN_BUFFER_MINUTES + grid-rounding has passed, same as any
 * on-time return.
 */
export const RETURN_GRACE_MINUTES = 15;

export class InvalidDroneBookingRequestError extends Error {
  constructor(reason: string) {
    super(`Invalid drone booking request: ${reason}`);
    this.name = "InvalidDroneBookingRequestError";
  }
}

/** Rounds a Date up to the next 30-minute mark (…:00 or …:30). Already-aligned instants pass through unchanged. */
export function alignToNextInterval(date: Date, intervalMinutes: number = SLOT_INTERVAL_MINUTES): Date {
  const aligned = new Date(date);
  aligned.setSeconds(0, 0);
  const remainder = aligned.getMinutes() % intervalMinutes;
  if (remainder !== 0) {
    aligned.setMinutes(aligned.getMinutes() + (intervalMinutes - remainder));
  } else if (aligned.getTime() < date.getTime()) {
    aligned.setMinutes(aligned.getMinutes() + intervalMinutes);
  }
  return aligned;
}

/** When a drone that's due back at `scheduledEnd` is next bookable — the buffer, rounded up onto the slot grid. */
export function droneReadyAt(scheduledEnd: Date): Date {
  const withBuffer = new Date(scheduledEnd.getTime() + RETURN_BUFFER_MINUTES * 60_000);
  return alignToNextInterval(withBuffer);
}

/** Whether an actual return at `actualReturn` counts as late against its `scheduledEnd`, allowing the grace window. */
export function isReturnLate(actualReturn: Date, scheduledEnd: Date): boolean {
  return actualReturn.getTime() > scheduledEnd.getTime() + RETURN_GRACE_MINUTES * 60_000;
}

export type DroneStatus = "AVAILABLE" | "RENTED" | "MAINTENANCE" | "LOST" | "RETIRED";
export type DroneCandidate = { id: string; humanId: string; status: DroneStatus };
export type BookingWindow = { droneId: string; startTime: Date; endTime: Date; status: string };

const INELIGIBLE_DRONE_STATUSES: readonly DroneStatus[] = ["MAINTENANCE", "LOST", "RETIRED"];

/** A booking in either of these statuses never actually occupied its drone — no return buffer to account for. */
export const TERMINAL_BOOKING_STATUSES = ["CANCELLED", "EXPIRED", "COMPLETED"];

function isDroneFreeFor(bookings: readonly BookingWindow[], droneId: string, start: Date, end: Date): boolean {
  return !bookings.some((b) => {
    if (b.droneId !== droneId) return false;
    if (TERMINAL_BOOKING_STATUSES.includes(b.status)) return false;
    const busyUntil = droneReadyAt(b.endTime);
    return start.getTime() < busyUntil.getTime() && b.startTime.getTime() < end.getTime();
  });
}

/** The lowest-humanId drone (AVAILABLE-eligible status, no conflicting booking once the return buffer is factored in) free for [start, end), or null. */
export function findEligibleDrone(
  drones: readonly DroneCandidate[],
  bookings: readonly BookingWindow[],
  start: Date,
  end: Date
): string | null {
  const candidates = drones
    .filter((d) => !INELIGIBLE_DRONE_STATUSES.includes(d.status))
    .filter((d) => isDroneFreeFor(bookings, d.id, start, end))
    .sort((a, b) => a.humanId.localeCompare(b.humanId));
  return candidates[0]?.id ?? null;
}

export type SlotResult =
  | { outcome: "CONFIRM"; droneId: string; startTime: Date; endTime: Date }
  | { outcome: "NEXT_FEASIBLE_SLOT"; droneId: string; startTime: Date; endTime: Date }
  | { outcome: "INFEASIBLE" };

/**
 * The real "can this booking happen" gate for a shop: no minimum lead time
 * (unlike the locker network's 120-minute rule) — the earliest a booking can
 * start is simply the next 30-minute mark at or after `earliestStartTime`.
 * Searches forward slot by slot until it finds a shop drone that's free for
 * the whole requested window.
 */
export function findNextAvailableSlot(
  drones: readonly DroneCandidate[],
  bookings: readonly BookingWindow[],
  durationMinutes: number,
  earliestStartTime: Date,
  maxLookaheadSlots: number = 96 // 48 hours at 30-minute steps
): SlotResult {
  if (durationMinutes <= 0) {
    throw new InvalidDroneBookingRequestError(`durationMinutes must be positive, got ${durationMinutes}`);
  }

  const requestedStart = alignToNextInterval(earliestStartTime);
  const durationMs = durationMinutes * 60_000;

  for (let i = 0; i <= maxLookaheadSlots; i++) {
    const startTime = new Date(requestedStart.getTime() + i * SLOT_INTERVAL_MINUTES * 60_000);
    const endTime = new Date(startTime.getTime() + durationMs);
    const droneId = findEligibleDrone(drones, bookings, startTime, endTime);
    if (droneId) {
      return i === 0
        ? { outcome: "CONFIRM", droneId, startTime, endTime }
        : { outcome: "NEXT_FEASIBLE_SLOT", droneId, startTime, endTime };
    }
  }

  return { outcome: "INFEASIBLE" };
}

/**
 * Which of the given candidate start times have zero eligible drone for
 * `durationMinutes` starting there — used to grey out slots in the
 * customer-facing table before they even tap one. Mirrors
 * getUnavailableWindowsAction's role in the locker network's BookingWizard.
 */
export function computeUnavailableStarts(
  drones: readonly DroneCandidate[],
  bookings: readonly BookingWindow[],
  durationMinutes: number,
  candidateStarts: readonly Date[]
): boolean[] {
  const durationMs = durationMinutes * 60_000;
  return candidateStarts.map((start) => {
    const end = new Date(start.getTime() + durationMs);
    return !findEligibleDrone(drones, bookings, start, end);
  });
}

/** "First available now" vs "available at HH:MM" for a shop's map marker — the soonest 1-hour-equivalent slot any of its drones can offer. */
export function firstAvailableAt(
  drones: readonly DroneCandidate[],
  bookings: readonly BookingWindow[],
  now: Date,
  durationMinutes: number = SLOT_INTERVAL_MINUTES * 2
): Date | null {
  const result = findNextAvailableSlot(drones, bookings, durationMinutes, now);
  return result.outcome === "INFEASIBLE" ? null : result.startTime;
}

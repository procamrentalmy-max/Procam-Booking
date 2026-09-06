import { alignToNextHour, findEligibleAsset, InvalidBookingRequestError } from "./feasibility";
import { commitmentsForBooking, existingCommitments, isWorkerScheduleFeasible } from "./workerSchedule";
import type { FleetSnapshot } from "./types";

export { InvalidBookingRequestError };

/** Customers must request a daytime slot at least this far ahead. */
export const MINIMUM_LEAD_MINUTES = 60;

export type LockerBookingRequest = {
  partnerId: string;
  /** Where the customer will return the camera — may differ from partnerId for a one-way rental. */
  dropoffPartnerId: string;
  durationMinutes: number;
  earliestStartTime: Date;
};

export type BookingGateResult =
  | { outcome: "CONFIRM"; assetId: string; startTime: Date; endTime: Date }
  | { outcome: "NEXT_FEASIBLE_SLOT"; assetId: string; startTime: Date; endTime: Date }
  | { outcome: "INFEASIBLE" };

/**
 * The real "can this booking actually happen" gate for a locker location:
 * inventory feasibility (Phase 3's `checkBookingFeasibility`) AND worker-
 * schedule feasibility (can the worker actually set up and be present for
 * the return, given every other commitment already on the books) both have
 * to pass at the SAME candidate hour — a booking needs both gates, not
 * either one alone. Searches forward hour by hour exactly like Phase 3,
 * just with an extra check at each candidate slot.
 *
 * Throws instead of silently accepting a request that violates a hard
 * rule: non-positive duration, or a start time inside the minimum lead
 * time (validated against `now`, not against `new Date()` at call time,
 * so this stays a pure, testable function).
 */
export function checkLockerBookingFeasibility(
  snapshot: FleetSnapshot,
  request: LockerBookingRequest,
  now: Date = new Date(),
  maxLookaheadHours: number = 24 * 7
): BookingGateResult {
  if (request.durationMinutes <= 0) {
    throw new InvalidBookingRequestError(`durationMinutes must be positive, got ${request.durationMinutes}`);
  }
  const earliestAllowed = new Date(now.getTime() + MINIMUM_LEAD_MINUTES * 60_000);
  if (request.earliestStartTime.getTime() < earliestAllowed.getTime()) {
    throw new InvalidBookingRequestError(`must be requested at least ${MINIMUM_LEAD_MINUTES} minutes ahead of now`);
  }

  const requestedStart = alignToNextHour(request.earliestStartTime);
  const durationMs = request.durationMinutes * 60_000;
  const commitments = existingCommitments(snapshot);

  for (let i = 0; i <= maxLookaheadHours; i++) {
    const startTime = new Date(requestedStart.getTime() + i * 60 * 60_000);
    const endTime = new Date(startTime.getTime() + durationMs);

    const assetId = findEligibleAsset(snapshot, startTime, endTime);
    if (!assetId) continue;

    const candidateCommitments = commitmentsForBooking(request.partnerId, request.dropoffPartnerId, startTime, endTime);
    if (!isWorkerScheduleFeasible(commitments, candidateCommitments, snapshot)) continue;

    return i === 0
      ? { outcome: "CONFIRM", assetId, startTime, endTime }
      : { outcome: "NEXT_FEASIBLE_SLOT", assetId, startTime, endTime };
  }

  return { outcome: "INFEASIBLE" };
}

/** Fixed nightly window: 10pm start, 8am return. */
export const OVERNIGHT_START_HOUR = 22;
export const OVERNIGHT_RETURN_HOUR = 8;
export const OVERNIGHT_DURATION_MINUTES = (24 - OVERNIGHT_START_HOUR + OVERNIGHT_RETURN_HOUR) * 60;

/** Customers must request an overnight slot at least this far ahead of its 10pm start (i.e. by 9pm). */
export const OVERNIGHT_LEAD_MINUTES = 60;

export type OvernightBookingRequest = {
  partnerId: string;
  /** Any Date on the desired night — only its calendar date is used; the start hour is always fixed at 10pm. */
  earliestNight: Date;
};

/**
 * Overnight is a separate, fixed nightly package (10pm-8am), priced and
 * marketed independently of the daytime menu. Per product decision, this
 * does NOT check worker-schedule feasibility against daytime bookings —
 * overnight is assumed to have its own dedicated handling, not something
 * proven safe by this function the way the daytime gate is. Camera
 * double-booking protection is never skipped for any booking type, so
 * this still runs the same `findEligibleAsset` check the daytime gate
 * uses — it only omits the worker-schedule half.
 */
export function checkOvernightBookingFeasibility(
  snapshot: FleetSnapshot,
  request: OvernightBookingRequest,
  now: Date = new Date(),
  maxLookaheadNights: number = 14
): BookingGateResult {
  for (let n = 0; n <= maxLookaheadNights; n++) {
    const startTime = new Date(request.earliestNight);
    startTime.setDate(startTime.getDate() + n);
    startTime.setHours(OVERNIGHT_START_HOUR, 0, 0, 0);

    const cutoff = new Date(startTime.getTime() - OVERNIGHT_LEAD_MINUTES * 60_000);
    if (now.getTime() > cutoff.getTime()) continue; // too late to book this specific night

    const endTime = new Date(startTime.getTime() + OVERNIGHT_DURATION_MINUTES * 60_000);
    const assetId = findEligibleAsset(snapshot, startTime, endTime);
    if (!assetId) continue;

    return n === 0
      ? { outcome: "CONFIRM", assetId, startTime, endTime }
      : { outcome: "NEXT_FEASIBLE_SLOT", assetId, startTime, endTime };
  }

  return { outcome: "INFEASIBLE" };
}

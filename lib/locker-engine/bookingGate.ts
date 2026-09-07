import { isTerminal } from "@/lib/state-machine/booking";
import { alignToNextHour, findEligibleAsset, InvalidBookingRequestError } from "./feasibility";
import { commitmentsForBooking, existingCommitments, isWorkerScheduleFeasible, isOvernightRoundFeasible, mytDayHour } from "./workerSchedule";
import type { FleetSnapshot } from "./types";

export { InvalidBookingRequestError };

/** Customers must request a daytime slot at least this far ahead. */
export const MINIMUM_LEAD_MINUTES = 120;

/** Fixed nightly window: 10pm start, 8am return. */
export const OVERNIGHT_START_HOUR = 22;
export const OVERNIGHT_RETURN_HOUR = 8;
export const OVERNIGHT_DURATION_MINUTES = (24 - OVERNIGHT_START_HOUR + OVERNIGHT_RETURN_HOUR) * 60;

/** Customers must request an overnight slot at least this far ahead of its 10pm start (i.e. by 8pm). */
export const OVERNIGHT_LEAD_MINUTES = 120;

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

/** Every non-terminal overnight booking's pickup location whose fixed 10pm start falls on the same MYT night as `deadline`. */
function overnightPickupsForNight(snapshot: FleetSnapshot, deadline: Date): string[] {
  return snapshot.bookings
    .filter((b) => !isTerminal(b.status) && b.isOvernight && b.startTime.getTime() === deadline.getTime())
    .map((b) => b.partnerId);
}

/**
 * The real "can this booking actually happen" gate for a locker location:
 * inventory feasibility (Phase 3's `checkBookingFeasibility`) AND worker-
 * schedule feasibility (can the worker actually set up and be present for
 * the return, given every other commitment already on the books) both have
 * to pass at the SAME candidate hour — a booking needs both gates, not
 * either one alone. Searches forward hour by hour exactly like Phase 3,
 * just with an extra check at each candidate slot.
 *
 * Also re-checks that same evening's overnight round (see
 * `checkOvernightBookingFeasibility`) still has room for every overnight
 * pickup already confirmed for that night — a late daytime booking
 * shouldn't be able to silently strand an overnight customer who already
 * has a confirmed pickup that same evening.
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

    const candidateCommitments = commitmentsForBooking(request.partnerId, request.dropoffPartnerId, startTime, endTime, false);
    if (!isWorkerScheduleFeasible(commitments, candidateCommitments, snapshot)) continue;

    const nightDeadline = mytDayHour(startTime, OVERNIGHT_START_HOUR);
    const roundPickups = overnightPickupsForNight(snapshot, nightDeadline);
    if (roundPickups.length > 0) {
      const mergedFixed = [...commitments, ...candidateCommitments];
      if (!isOvernightRoundFeasible(mergedFixed, roundPickups, nightDeadline, snapshot)) continue;
    }

    return i === 0
      ? { outcome: "CONFIRM", assetId, startTime, endTime }
      : { outcome: "NEXT_FEASIBLE_SLOT", assetId, startTime, endTime };
  }

  return { outcome: "INFEASIBLE" };
}

export type OvernightBookingRequest = {
  partnerId: string;
  /** Where the customer will return the camera — may differ from partnerId for a one-way rental. */
  dropoffPartnerId: string;
  /** Any Date on the desired night — only its calendar date is used; the start hour is always fixed at 10pm. */
  earliestNight: Date;
};

/**
 * Overnight is a separate, fixed nightly package (10pm-8am), priced and
 * marketed independently of the daytime menu. Its RETURN commitment is a
 * fixed worker-presence commitment exactly like daytime's. Its SETUP is
 * NOT — every overnight booking shares the same fixed network-wide 10pm
 * start, and it's a self-service PIN pickup, so the worker can stage it
 * any time earlier in the evening rather than needing to be live at the
 * exact instant. `isOvernightRoundFeasible` checks whether the worker can
 * visit every overnight pickup due that night (existing confirmed ones,
 * plus this candidate), in some order, all finishing by 10pm — so capacity
 * scales with however many pickups the worker can actually reach in time,
 * not an arbitrary "one per night." This used to be skipped entirely,
 * which allowed an overnight pickup to be accepted the same night a
 * daytime booking had already committed the worker to a different,
 * unreachable location (confirmed via simulation) — that's still caught,
 * via the fixed-commitment chain check below plus the round check's own
 * anchor, which is whatever fixed commitment (daytime or another night's
 * overnight return) ends latest before 10pm.
 */
export function checkOvernightBookingFeasibility(
  snapshot: FleetSnapshot,
  request: OvernightBookingRequest,
  now: Date = new Date(),
  maxLookaheadNights: number = 14
): BookingGateResult {
  const commitments = existingCommitments(snapshot);

  for (let n = 0; n <= maxLookaheadNights; n++) {
    const startTime = new Date(request.earliestNight);
    startTime.setDate(startTime.getDate() + n);
    startTime.setHours(OVERNIGHT_START_HOUR, 0, 0, 0);

    const cutoff = new Date(startTime.getTime() - OVERNIGHT_LEAD_MINUTES * 60_000);
    if (now.getTime() > cutoff.getTime()) continue; // too late to book this specific night

    const endTime = new Date(startTime.getTime() + OVERNIGHT_DURATION_MINUTES * 60_000);
    const assetId = findEligibleAsset(snapshot, startTime, endTime);
    if (!assetId) continue;

    const candidateCommitments = commitmentsForBooking(request.partnerId, request.dropoffPartnerId, startTime, endTime, true);
    if (!isWorkerScheduleFeasible(commitments, candidateCommitments, snapshot)) continue;

    const roundPickups = [...overnightPickupsForNight(snapshot, startTime), request.partnerId];
    const mergedFixed = [...commitments, ...candidateCommitments];
    if (!isOvernightRoundFeasible(mergedFixed, roundPickups, startTime, snapshot)) continue;

    return n === 0
      ? { outcome: "CONFIRM", assetId, startTime, endTime }
      : { outcome: "NEXT_FEASIBLE_SLOT", assetId, startTime, endTime };
  }

  return { outcome: "INFEASIBLE" };
}

import { alignToNextHour, findEligibleAsset, InvalidBookingRequestError } from "./feasibility";
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
  /** Where the customer will return the camera — may differ from partnerId for a one-way rental. Doesn't affect acceptance (see below) — only where the worker eventually needs to route the camera to and from. */
  dropoffPartnerId: string;
  durationMinutes: number;
  earliestStartTime: Date;
};

export type BookingGateResult =
  | { outcome: "CONFIRM"; assetId: string; startTime: Date; endTime: Date }
  | { outcome: "NEXT_FEASIBLE_SLOT"; assetId: string; startTime: Date; endTime: Date }
  | { outcome: "INFEASIBLE" };

/**
 * The real "can this booking actually happen" gate for a locker location.
 * Acceptance is pure inventory: is there a camera that's either already
 * AVAILABLE, or whose last rental ended long enough ago to trust it's
 * ready (`findEligibleAsset` / `isAssetReadyFor` in feasibility.ts) —
 * regardless of that camera's current location or the travel time to get
 * it here. Location and travel time are the worker's routing problem
 * (routing.ts), not a reason to reject a booking outright; a small
 * network where every leg is a short drive doesn't need per-minute
 * worker-presence commitments to stay honest, just a generous turnaround
 * buffer on each camera.
 *
 * Searches forward hour by hour, exactly like the older pure-inventory
 * check this superseded, since the eligibility rule itself already
 * accounts for everything that used to need a separate worker-schedule
 * pass.
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

  for (let i = 0; i <= maxLookaheadHours; i++) {
    const startTime = new Date(requestedStart.getTime() + i * 60 * 60_000);
    const endTime = new Date(startTime.getTime() + durationMs);

    const assetId = findEligibleAsset(snapshot, startTime, endTime);
    if (!assetId) continue;

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
 * marketed independently of the daytime menu — but accepted by the exact
 * same rule as daytime now: any camera that's AVAILABLE or has cleared its
 * turnaround buffer is eligible, so overnight capacity scales with however
 * many cameras the fleet actually has free that night, with no per-booking
 * cap and no travel-time cross-checking between different overnight
 * pickups. The worker still has to actually get to every pickup by 10pm —
 * that's routing.ts's job to plan for, not this gate's job to pre-verify.
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

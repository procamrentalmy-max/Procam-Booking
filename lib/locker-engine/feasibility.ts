import { hasOverlappingBooking } from "./bookingWindow";
import type { FleetSnapshot } from "./types";

/**
 * Same exclusion list `lib/booking/availability.ts` already uses for the
 * reception flow: MAINTENANCE/LOST/RETIRED are the only statuses that
 * disqualify a camera as a *future* candidate — everything else (CLEANING,
 * CHARGING, RENTED, ...) is expected to cycle back to AVAILABLE on its own,
 * so it's still a valid candidate for a slot that isn't right now.
 */
const INELIGIBLE_STATUSES = ["MAINTENANCE", "LOST", "RETIRED"] as const;

export type BookingRequest = {
  durationMinutes: number;
  earliestStartTime: Date;
};

export type FeasibilityResult =
  | { outcome: "CONFIRM"; assetId: string; startTime: Date; endTime: Date }
  | { outcome: "NEXT_FEASIBLE_SLOT"; assetId: string; startTime: Date; endTime: Date }
  | { outcome: "INFEASIBLE" };

export class InvalidBookingRequestError extends Error {
  constructor(reason: string) {
    super(`Invalid booking request: ${reason}`);
    this.name = "InvalidBookingRequestError";
  }
}

/** Rounds up to the next full hour — the locker network only ever offers hourly pickup slots. */
export function alignToNextHour(date: Date): Date {
  const aligned = new Date(date);
  aligned.setMinutes(0, 0, 0);
  if (aligned.getTime() < date.getTime()) {
    aligned.setHours(aligned.getHours() + 1);
  }
  return aligned;
}

function findEligibleAsset(snapshot: FleetSnapshot, start: Date, end: Date): string | null {
  const candidates = snapshot.assets
    .filter((a) => !a.isHotSpare)
    .filter((a) => !(INELIGIBLE_STATUSES as readonly string[]).includes(a.status))
    .filter((a) => !hasOverlappingBooking(snapshot, a.id, start, end))
    .sort((a, b) => a.humanId.localeCompare(b.humanId));
  return candidates[0]?.id ?? null;
}

/**
 * Pure inventory feasibility: "is there enough fleet to cover this request
 * at all," independent of whether a worker could physically get a camera
 * to the requested location in time — that's the routing engine (Phase 4).
 * A booking needs BOTH gates to pass; this is only one of them.
 *
 * The fleet's hard cap (6 sellable cameras) and "never sell the hot spare"
 * aren't special-cased here — they fall out naturally from what's actually
 * in the snapshot (only 6 non-spare assets exist) and the `!a.isHotSpare`
 * filter. "Confirmed beats forecast" from the brief isn't implemented yet:
 * there's no demand-forecasting data model to weigh against (that's
 * Phase 13) — every booking here is either a real request or nothing.
 *
 * Validates its own input rather than trusting the caller: a request
 * starting in the past, or with a non-positive duration, throws instead of
 * silently confirming a nonsensical booking (found by adversarial testing
 * — both previously produced a "successful" CONFIRM).
 */
export function checkBookingFeasibility(
  snapshot: FleetSnapshot,
  request: BookingRequest,
  now: Date = new Date(),
  maxLookaheadHours: number = 24 * 7
): FeasibilityResult {
  if (request.durationMinutes <= 0) {
    throw new InvalidBookingRequestError(`durationMinutes must be positive, got ${request.durationMinutes}`);
  }
  if (request.earliestStartTime < now) {
    throw new InvalidBookingRequestError("earliestStartTime cannot be in the past");
  }

  const requestedStart = alignToNextHour(request.earliestStartTime);
  const durationMs = request.durationMinutes * 60_000;

  for (let i = 0; i <= maxLookaheadHours; i++) {
    const startTime = new Date(requestedStart.getTime() + i * 60 * 60_000);
    const endTime = new Date(startTime.getTime() + durationMs);
    const assetId = findEligibleAsset(snapshot, startTime, endTime);
    if (assetId) {
      return i === 0
        ? { outcome: "CONFIRM", assetId, startTime, endTime }
        : { outcome: "NEXT_FEASIBLE_SLOT", assetId, startTime, endTime };
    }
  }

  return { outcome: "INFEASIBLE" };
}

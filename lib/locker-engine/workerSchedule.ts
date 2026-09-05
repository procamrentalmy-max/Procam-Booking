import { isTerminal } from "@/lib/state-machine/booking";
import type { FleetSnapshot } from "./types";

/** ~5-7 minutes to service one camera / set its locker PIN, or process a return — 15 min budgeted for either. */
export const STOP_MINUTES = 15;

/** Customer return grace period — the worker must stay available through this window, not just at the exact end_time. */
export const RETURN_GRACE_MINUTES = 10;

/** Worker's day starts at 7am; no commitment may ever require presence before this. */
export const WORKER_START_HOUR = 7;

export type WorkerCommitment = {
  partnerId: string;
  start: Date;
  end: Date;
};

/**
 * The two hard worker-presence commitments a single booking creates:
 *
 * - SETUP: must finish exactly at start_time — the camera has to be
 *   delivered and configured (PIN set) before the customer arrives, not
 *   handed over live.
 * - RETURN: starts at end_time and blocks the full grace period plus
 *   processing time. The worker must already be at the location when the
 *   customer returns the camera, not start traveling there afterward
 *   (explicit product rule) — this worst-case window (grace + processing)
 *   is what gets blocked, since the exact return moment within the grace
 *   period isn't known in advance.
 */
export function commitmentsForBooking(partnerId: string, startTime: Date, endTime: Date): WorkerCommitment[] {
  const setup: WorkerCommitment = {
    partnerId,
    start: new Date(startTime.getTime() - STOP_MINUTES * 60_000),
    end: startTime,
  };
  const returnCommitment: WorkerCommitment = {
    partnerId,
    start: endTime,
    end: new Date(endTime.getTime() + (RETURN_GRACE_MINUTES + STOP_MINUTES) * 60_000),
  };
  return [setup, returnCommitment];
}

/** Every non-terminal booking's worker commitments, derived from the snapshot's bookings — the single source of truth, nothing stored separately. */
export function existingCommitments(snapshot: FleetSnapshot): WorkerCommitment[] {
  return snapshot.bookings
    .filter((b) => !isTerminal(b.status))
    .flatMap((b) => commitmentsForBooking(b.partnerId, b.startTime, b.endTime));
}

function travelMinutesBetween(snapshot: FleetSnapshot, from: string, to: string): number {
  if (from === to) return 0;
  const entry = snapshot.travelTimes.find((t) => t.fromPartnerId === from && t.toPartnerId === to);
  return entry?.minutes ?? Infinity;
}

/** Same calendar day's 7am — a commitment before that on its own day violates the floor. */
function workerStartFloorFor(date: Date): Date {
  const floor = new Date(date);
  floor.setHours(WORKER_START_HOUR, 0, 0, 0);
  return floor;
}

/**
 * Whether adding `newCommitments` to `existing` keeps the worker's whole
 * day conflict-free: every commitment sorted chronologically must be
 * reachable from the end of the one before it — same location is instant,
 * a different location costs its travel time — and nothing may require
 * presence before the worker's day has started.
 */
export function isWorkerScheduleFeasible(
  existing: WorkerCommitment[],
  newCommitments: WorkerCommitment[],
  snapshot: FleetSnapshot
): boolean {
  if (newCommitments.some((c) => c.start.getTime() < workerStartFloorFor(c.start).getTime())) {
    return false;
  }
  const all = [...existing, ...newCommitments].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (let i = 1; i < all.length; i++) {
    const prev = all[i - 1];
    const cur = all[i];
    const travel = travelMinutesBetween(snapshot, prev.partnerId, cur.partnerId);
    const availableAt = prev.end.getTime() + travel * 60_000;
    if (availableAt > cur.start.getTime()) return false;
  }
  return true;
}

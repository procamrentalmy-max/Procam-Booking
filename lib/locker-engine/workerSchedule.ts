import { isTerminal } from "@/lib/state-machine/booking";
import type { FleetSnapshot } from "./types";

/** ~5-7 minutes to service one camera / set its locker PIN, or process a return — 15 min budgeted for either. */
export const STOP_MINUTES = 15;

/** Customer return grace period — the worker must stay available through this window, not just at the exact end_time. */
export const RETURN_GRACE_MINUTES = 10;

/** Worker's day starts at 7am Malaysia time; no commitment may ever require presence before this. */
export const WORKER_START_HOUR = 7;

/** Malaysia has no DST — a fixed UTC+8 offset covers it exactly, no timezone library needed. */
const MALAYSIA_UTC_OFFSET_HOURS = 8;

export type WorkerCommitment = {
  partnerId: string;
  start: Date;
  end: Date;
};

/**
 * The hard worker-presence commitments a single DAYTIME booking creates —
 * overnight bookings create none of these; see below.
 *
 * - SETUP: at the pickup location, must finish exactly at start_time — the
 *   camera has to be delivered and configured (PIN set) before the
 *   customer arrives, not handed over live.
 * - RETURN: at the dropoff location (may differ from pickup — one-way
 *   rentals), starts at end_time and blocks the full grace period plus
 *   processing time. The worker must already be at the location when the
 *   customer returns the camera, not start traveling there afterward
 *   (explicit product rule) — this worst-case window (grace + processing)
 *   is what gets blocked, since the exact return moment within the grace
 *   period isn't known in advance.
 *
 * Overnight bookings all share one fixed network-wide start time (10pm)
 * and return time (8am), unlike daytime's per-customer chosen hour — so
 * pinning either to a fixed instant would mean at most ONE overnight
 * pickup (or return) could ever be handled per night, network-wide, no
 * matter how many cameras or locations exist. That doesn't match reality:
 * it's self-service (PIN pickup, self-submitted return condition check —
 * no staff needed at either instant), so the worker can stage pickups any
 * time earlier in the evening and collect returns any time after 8am.
 * Overnight bookings therefore create NO fixed commitments here — pickup
 * feasibility is checked separately by `isOvernightRoundFeasible`, as a
 * flexible task that just needs to land somewhere before the 10pm
 * deadline; actual return collection is a routing/collection concern
 * (lib/locker-engine/collection.ts), not this booking-acceptance gate.
 */
export function commitmentsForBooking(
  pickupPartnerId: string,
  dropoffPartnerId: string,
  startTime: Date,
  endTime: Date,
  isOvernight: boolean = false
): WorkerCommitment[] {
  if (isOvernight) return [];

  const returnCommitment: WorkerCommitment = {
    partnerId: dropoffPartnerId,
    start: endTime,
    end: new Date(endTime.getTime() + (RETURN_GRACE_MINUTES + STOP_MINUTES) * 60_000),
  };
  const setup: WorkerCommitment = {
    partnerId: pickupPartnerId,
    start: new Date(startTime.getTime() - STOP_MINUTES * 60_000),
    end: startTime,
  };
  return [setup, returnCommitment];
}

/** Every non-terminal booking's FIXED worker commitments (excludes overnight setups — see isOvernightRoundFeasible), derived from the snapshot's bookings — the single source of truth, nothing stored separately. */
export function existingCommitments(snapshot: FleetSnapshot): WorkerCommitment[] {
  return snapshot.bookings
    .filter((b) => !isTerminal(b.status))
    .flatMap((b) => commitmentsForBooking(b.partnerId, b.dropoffPartnerId, b.startTime, b.endTime, b.isOvernight));
}

export function travelMinutesBetween(snapshot: FleetSnapshot, from: string, to: string): number {
  if (from === to) return 0;
  const entry = snapshot.travelTimes.find((t) => t.fromPartnerId === from && t.toPartnerId === to);
  return entry?.minutes ?? Infinity;
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const rest_perm of permutations(rest)) result.push([items[i], ...rest_perm]);
  }
  return result;
}

/**
 * A given hour on the same Malaysia-local calendar day as `date`. "The
 * worker's day" belongs to a real person living in Malaysia, not to
 * whatever timezone the server process happens to be in (UTC in
 * production, but possibly anything on a developer's own machine) — using
 * the server's local time here was a real, previously-latent bug (setHours
 * instead of an explicit, fixed offset). Anchored to a fixed +8h offset
 * rather than server/session local time; the DB-level worker-schedule
 * check (0012/0014_*.sql) mirrors this exact threshold via `at time zone
 * 'Asia/Kuala_Lumpur'` and must agree with it.
 */
export function mytDayHour(date: Date, hour: number): Date {
  const myt = new Date(date.getTime() + MALAYSIA_UTC_OFFSET_HOURS * 3_600_000);
  myt.setUTCHours(hour, 0, 0, 0);
  return new Date(myt.getTime() - MALAYSIA_UTC_OFFSET_HOURS * 3_600_000);
}

/** The worker's day starts at 7am Malaysia time; no commitment may ever require presence before this on its own day. */
export function workerStartFloorFor(date: Date): Date {
  return mytDayHour(date, WORKER_START_HOUR);
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

/**
 * Whether the worker can visit every overnight pickup due on one night —
 * `pickupPartnerIds`, one entry per booking, duplicates allowed — in SOME
 * order, each needing its own STOP_MINUTES, all finishing by `deadline`
 * (that night's fixed 10pm start). Starts from wherever `fixedCommitments`
 * leaves the worker: the latest one that starts before the deadline (its
 * end time + location), or the day's 7am floor with no location constraint
 * if nothing precedes it that day — same convention as the first
 * commitment of any day in `isWorkerScheduleFeasible`.
 *
 * Brute-forces every ordering rather than a nearest-neighbor heuristic:
 * with a handful of locker locations this is cheap, and it's the only way
 * to never wrongly reject an order that would actually have worked.
 */
export function isOvernightRoundFeasible(
  fixedCommitments: WorkerCommitment[],
  pickupPartnerIds: string[],
  deadline: Date,
  snapshot: FleetSnapshot
): boolean {
  if (pickupPartnerIds.length === 0) return true;

  const sameDayFixed = fixedCommitments
    .filter((c) => c.start.getTime() < deadline.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const anchor = sameDayFixed[sameDayFixed.length - 1] ?? null;
  const anchorTime = anchor ? anchor.end.getTime() : workerStartFloorFor(deadline).getTime();
  const anchorLocation = anchor ? anchor.partnerId : null;

  for (const order of permutations(pickupPartnerIds)) {
    let time = anchorTime;
    let location = anchorLocation;
    let feasible = true;
    for (const partnerId of order) {
      if (location !== null) {
        const travel = travelMinutesBetween(snapshot, location, partnerId);
        if (travel === Infinity) {
          feasible = false;
          break;
        }
        time += travel * 60_000;
      }
      time += STOP_MINUTES * 60_000;
      location = partnerId;
    }
    if (feasible && time <= deadline.getTime()) return true;
  }
  return false;
}

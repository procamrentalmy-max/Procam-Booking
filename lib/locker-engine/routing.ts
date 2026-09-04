import { isTerminal } from "@/lib/state-machine/booking";
import { selectCamerasForCollection } from "./collection";
import type { FleetSnapshot } from "./types";

/** "Next or next 2 hours" — how far ahead a location's confirmed bookings count toward its dropoff need. */
export const DEFAULT_DROPOFF_LOOKAHEAD_MINUTES = 120;

/** ~5-7 minutes to service one camera and set its locker PIN — midpoint used for planning. */
export const SERVICE_MINUTES_PER_CAMERA = 6;

function countUpcomingBookingsAt(
  snapshot: FleetSnapshot,
  partnerId: string,
  now: Date,
  lookaheadMinutes: number
): number {
  const horizonEnd = new Date(now.getTime() + lookaheadMinutes * 60_000);
  return snapshot.bookings.filter(
    (b) => b.partnerId === partnerId && !isTerminal(b.status) && b.startTime >= now && b.startTime <= horizonEnd
  ).length;
}

function countOnSiteAvailable(snapshot: FleetSnapshot, partnerId: string): number {
  return snapshot.assets.filter((a) => a.partnerId === partnerId && !a.isHotSpare && a.status === "AVAILABLE").length;
}

/**
 * How many cameras short each location is to cover its own confirmed
 * bookings in the next `lookaheadMinutes` (default 2hr) — "enough" means
 * on-site AVAILABLE cameras already meet or exceed upcoming demand. Only
 * locations with a positive shortfall are included. Computed once, up
 * front, against the frozen snapshot — the simulation below consumes this
 * as a fixed cycle's worth of demand.
 */
export function computeDropoffNeeds(
  snapshot: FleetSnapshot,
  now: Date,
  lookaheadMinutes: number = DEFAULT_DROPOFF_LOOKAHEAD_MINUTES
): Map<string, number> {
  const needs = new Map<string, number>();
  for (const location of snapshot.locations) {
    const needed = countUpcomingBookingsAt(snapshot, location.partnerId, now, lookaheadMinutes);
    const onSite = countOnSiteAvailable(snapshot, location.partnerId);
    const shortfall = needed - onSite;
    if (shortfall > 0) {
      needs.set(location.partnerId, shortfall);
    }
  }
  return needs;
}

function travelMinutes(snapshot: FleetSnapshot, from: string | null, to: string): number {
  if (from === null || from === to) return 0;
  const entry = snapshot.travelTimes.find((t) => t.fromPartnerId === from && t.toPartnerId === to);
  return entry?.minutes ?? Infinity;
}

function nearest(snapshot: FleetSnapshot, from: string | null, candidates: string[]): string | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((best, id) =>
    travelMinutes(snapshot, from, id) < travelMinutes(snapshot, from, best) ? id : best
  );
}

export type RouteStopAction =
  | { type: "DROPOFF"; assetIds: string[] }
  | { type: "PICKUP"; assetIds: string[] }
  | { type: "SERVICE"; assetIds: string[] };

export type RouteStop = {
  partnerId: string;
  actions: RouteStopAction[];
};

export type RoutePlan = {
  stops: RouteStop[];
  /** Dropoff shortfalls that couldn't be covered this cycle even after picking up everything reachable. */
  unmetDropoffs: { partnerId: string; shortfall: number }[];
};

/**
 * Plans the worker's next stops for this cycle:
 *
 * 1. If current in-hand serviced inventory won't cover every location's
 *    dropoff shortfall, top up first — visit the nearest spot with
 *    anything collectible (a returned camera, or surplus AVAILABLE
 *    cameras this same location doesn't need soon — reuses the exact
 *    Phase 2 collection rule, so a spot over-supplied relative to its own
 *    demand can supply a spot that's short, not just returns). Anything
 *    already AVAILABLE goes straight into ready inventory — it's already
 *    serviced; only raw returns need the SERVICE step.
 * 2. Visit every location that needs a dropoff, nearest-first, before any
 *    location that's pickup-only. Anything collectible along the way is
 *    picked up but NOT serviced yet — servicing is deferred so it never
 *    delays a confirmed-booking dropoff.
 * 3. Once every dropoff is handled, service whatever raw returns have
 *    piled up in the van — they become spare inventory for the next cycle.
 * 4. Visit any remaining pickup-only locations.
 *
 * Every physical camera can be moved at most once per plan — `movedAssetIds`
 * is the single source of truth for that, so a location visited for more
 * than one reason (e.g. a top-up source that's also a dropoff-need spot)
 * never gets "picked up" twice for the same camera.
 *
 * Deterministic greedy nearest-first chaining via the (mock) travel-time
 * matrix, not a full route optimizer — matches the rest of this engine's
 * "simple, testable, correct" approach over "provably optimal."
 */
export function planRoute(
  snapshot: FleetSnapshot,
  now: Date,
  lookaheadMinutes: number = DEFAULT_DROPOFF_LOOKAHEAD_MINUTES
): RoutePlan {
  const worker = snapshot.workers.find((w) => w.active);
  let currentLocation: string | null = worker?.currentPartnerId ?? null;

  const remainingDropoffs = computeDropoffNeeds(snapshot, now, lookaheadMinutes);
  const assetById = new Map(snapshot.assets.map((a) => [a.id, a]));

  const movedAssetIds = new Set<string>();

  function collectibleAt(partnerId: string): string[] {
    return selectCamerasForCollection(snapshot, partnerId, now, lookaheadMinutes).filter(
      (id) => !movedAssetIds.has(id)
    );
  }

  function supplySpots(): string[] {
    return snapshot.locations.map((l) => l.partnerId).filter((id) => collectibleAt(id).length > 0);
  }

  const readyInventory: string[] = snapshot.assets
    .filter((a) => a.partnerId === null && !a.isHotSpare && a.status === "AVAILABLE")
    .map((a) => a.id);
  let rawInventory: string[] = [];

  const stops: RouteStop[] = [];
  const unmetDropoffs: { partnerId: string; shortfall: number }[] = [];

  function stopFor(partnerId: string): RouteStop {
    let stop = stops.find((s) => s.partnerId === partnerId);
    if (!stop) {
      stop = { partnerId, actions: [] };
      stops.push(stop);
    }
    return stop;
  }

  /** Collects everything still collectible here. Already-AVAILABLE surplus goes straight to ready inventory; raw returns wait for a later SERVICE action. */
  function doPickup(partnerId: string): void {
    const items = collectibleAt(partnerId);
    if (items.length === 0) return;
    stopFor(partnerId).actions.push({ type: "PICKUP", assetIds: items });
    for (const id of items) {
      movedAssetIds.add(id);
      if (assetById.get(id)!.status === "AVAILABLE") {
        readyInventory.push(id);
      } else {
        rawInventory.push(id);
      }
    }
  }

  function serviceRawInventory(atPartnerId: string): void {
    if (rawInventory.length === 0) return;
    stopFor(atPartnerId).actions.push({ type: "SERVICE", assetIds: [...rawInventory] });
    readyInventory.push(...rawInventory);
    rawInventory = [];
  }

  function totalRemainingShortfall(): number {
    return [...remainingDropoffs.values()].reduce((sum, n) => sum + n, 0);
  }

  while (remainingDropoffs.size > 0 || supplySpots().length > 0) {
    const needMoreSupply = readyInventory.length < totalRemainingShortfall();
    const unvisitedSupply = supplySpots();

    if (needMoreSupply && unvisitedSupply.length > 0) {
      const next = nearest(snapshot, currentLocation, unvisitedSupply);
      if (!next) break;
      doPickup(next);
      serviceRawInventory(next); // needed now to cover an urgent shortfall
      currentLocation = next;
      continue;
    }

    if (remainingDropoffs.size > 0) {
      const next = nearest(snapshot, currentLocation, [...remainingDropoffs.keys()]);
      if (!next) break;
      const shortfall = remainingDropoffs.get(next)!;
      const toDrop = readyInventory.splice(0, shortfall);
      if (toDrop.length > 0) {
        stopFor(next).actions.push({ type: "DROPOFF", assetIds: toDrop });
      }
      if (toDrop.length < shortfall) {
        unmetDropoffs.push({ partnerId: next, shortfall: shortfall - toDrop.length });
      }
      doPickup(next); // collect anything still here too — servicing deferred
      remainingDropoffs.delete(next);
      currentLocation = next;
      continue;
    }

    // No dropoffs left: service what's piled up, then mop up pickup-only spots.
    if (unvisitedSupply.length > 0) {
      const next = nearest(snapshot, currentLocation, unvisitedSupply);
      if (!next) break;
      doPickup(next);
      serviceRawInventory(next);
      currentLocation = next;
      continue;
    }

    break;
  }

  if (rawInventory.length > 0 && currentLocation) {
    serviceRawInventory(currentLocation);
  }

  return { stops, unmetDropoffs };
}

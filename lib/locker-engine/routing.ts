import { isTerminal } from "@/lib/state-machine/booking";
import { selectCamerasForCollection } from "./collection";
import type { FleetSnapshot } from "./types";

/** "Next or next 2 hours" — how far ahead a location's confirmed bookings count toward its dropoff need. */
export const DEFAULT_DROPOFF_LOOKAHEAD_MINUTES = 120;

/**
 * "Next hour" — the strict top priority tier. Every dropoff-need location
 * with a booking due this soon is visited, nearest-first among themselves,
 * before the worker touches ANY location whose only need falls in the
 * next-2-hours (but not next-hour) tier — regardless of which is physically
 * closer. Only once every next-hour spot is covered does distance-only
 * nearest-first resume for the remaining next-2-hours spots.
 */
export const URGENT_DROPOFF_LOOKAHEAD_MINUTES = 60;

/** ~5-7 minutes to service one camera and set its locker PIN — midpoint used for planning. */
export const SERVICE_MINUTES_PER_CAMERA = 6;

/** Assumed travel time between two locations with no entry in location_travel_times yet — a starting default until a real Google Maps time is entered for that pair. */
export const DEFAULT_TRAVEL_MINUTES = 15;

/** Above this many simultaneous candidates, permutation search is skipped in favor of plain nearest-first — the locker network is small enough that this never actually triggers today, it's just a safety cap against factorial blowup if it grows a lot. */
const MAX_PERMUTATION_CANDIDATES = 8;

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
  return entry?.minutes ?? DEFAULT_TRAVEL_MINUTES;
}

function* permutations<T>(items: T[]): Generator<T[]> {
  if (items.length <= 1) {
    yield items;
    return;
  }
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) {
      yield [items[i], ...tail];
    }
  }
}

/**
 * The one candidate to visit first — chosen not just by which is nearest,
 * but by which full visiting order of ALL the given candidates has the
 * lowest total travel time starting from `from` (e.g. for candidates
 * [A, B, C], compares current→A→B→C vs current→A→C→B vs every other
 * ordering). Plain nearest-first can strand the worker far from the rest
 * of a same-priority batch even when a different first hop gets the whole
 * batch done sooner; this is the actual "shortest total route" the
 * business wants, computed fresh over whatever the current candidate set
 * is (which itself can change stop to stop as the simulation progresses).
 */
function nearestInOptimalOrder(snapshot: FleetSnapshot, from: string | null, candidates: string[]): string | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1 || candidates.length > MAX_PERMUTATION_CANDIDATES) {
    return candidates.reduce((best, id) =>
      travelMinutes(snapshot, from, id) < travelMinutes(snapshot, from, best) ? id : best
    );
  }

  let bestFirstStop = candidates[0];
  let bestTotal = Infinity;
  for (const order of permutations(candidates)) {
    let total = 0;
    let cursor = from;
    for (const stop of order) {
      total += travelMinutes(snapshot, cursor, stop);
      cursor = stop;
    }
    if (total < bestTotal) {
      bestTotal = total;
      bestFirstStop = order[0];
    }
  }
  return bestFirstStop;
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
 * 2. Visit every location that needs a dropoff before any location that's
 *    pickup-only. Within the dropoffs, next-hour-urgent locations are
 *    visited first (nearest-first among themselves), then the remaining
 *    next-2-hours locations (nearest-first among themselves) — urgency tier
 *    always beats distance. Anything collectible along the way is picked up
 *    but NOT serviced yet — servicing is deferred so it never delays a
 *    confirmed-booking dropoff.
 * 3. Once every dropoff is handled, service whatever raw returns have
 *    piled up in the van — they become spare inventory for the next cycle.
 * 4. Visit any remaining location with a genuine uncollected return — a
 *    location with ONLY surplus AVAILABLE cameras (fine sitting exactly
 *    where they are, just not needed there soon) is never a reason on its
 *    own to send the worker somewhere; only a real, uncollected return
 *    counts (see returnOnlySpots()). Otherwise a day with zero bookings
 *    would route the worker to strip every deployed camera from every
 *    location for no operational reason — a real bug this fixes.
 *
 * Every physical camera can be moved at most once per plan — `movedAssetIds`
 * is the single source of truth for that, so a location visited for more
 * than one reason (e.g. a top-up source that's also a dropoff-need spot)
 * never gets "picked up" twice for the same camera.
 *
 * Chains stop to stop using nearestInOptimalOrder(), which picks the first
 * hop of whichever full visiting order of the current candidate batch has
 * the lowest total travel time (a small permutation search, not plain
 * nearest-first) — so a same-priority batch of several locations gets the
 * actual shortest route through all of them, not just whichever's closest
 * right now. The one place distance is NOT the deciding factor at all is
 * which dropoff-need spot to visit next: next-hour need beats next-2-hours
 * need beats distance (see urgentDropoffs below), matching the priority the
 * business actually wants; distance only orders within a tier.
 */
export function planRoute(
  snapshot: FleetSnapshot,
  now: Date,
  lookaheadMinutes: number = DEFAULT_DROPOFF_LOOKAHEAD_MINUTES,
  urgentLookaheadMinutes: number = URGENT_DROPOFF_LOOKAHEAD_MINUTES
): RoutePlan {
  const worker = snapshot.workers.find((w) => w.active);
  let currentLocation: string | null = worker?.currentPartnerId ?? null;

  const remainingDropoffs = computeDropoffNeeds(snapshot, now, lookaheadMinutes);
  /** Locations whose shortfall includes a booking due within the urgent (next-hour) window — takes priority over distance when picking the next dropoff stop. */
  const urgentDropoffs = computeDropoffNeeds(snapshot, now, urgentLookaheadMinutes);
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

  /**
   * Narrower than supplySpots(): a location with only surplus AVAILABLE
   * cameras (not needed soon, but otherwise fine sitting exactly where
   * they are) is NOT a reason on its own to send the worker there — that
   * would mean routing the worker to strip every deployed camera from
   * every location on a day with zero bookings, which is what happened
   * before this existed. A genuine, uncollected return is a real
   * operational need (it has to come in for inspection) and DOES justify
   * a special trip; supplySpots() (surplus included) still applies once
   * some OTHER need already justifies being there — via the top-up phase
   * below, or by riding along at a stop already justified some other way.
   */
  function hasUncollectedReturn(partnerId: string): boolean {
    return snapshot.assets.some(
      (a) => a.partnerId === partnerId && a.status === "RETURNED_AWAITING_INSPECTION" && !movedAssetIds.has(a.id)
    );
  }

  function returnOnlySpots(): string[] {
    return snapshot.locations.map((l) => l.partnerId).filter((id) => hasUncollectedReturn(id));
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

  /** Among the given dropoff-need locations, next-hour-urgent ones (if any) win outright; distance only breaks ties within a tier. */
  function pickDropoffTarget(candidates: string[]): string | null {
    const urgent = candidates.filter((id) => urgentDropoffs.has(id));
    return nearestInOptimalOrder(snapshot, currentLocation, urgent.length > 0 ? urgent : candidates);
  }

  while (remainingDropoffs.size > 0 || returnOnlySpots().length > 0) {
    const needMoreSupply = readyInventory.length < totalRemainingShortfall();
    const unvisitedSupply = supplySpots();

    if (needMoreSupply && unvisitedSupply.length > 0) {
      const next = nearestInOptimalOrder(snapshot, currentLocation, unvisitedSupply);
      if (!next) break;
      doPickup(next);
      serviceRawInventory(next); // needed now to cover an urgent shortfall
      currentLocation = next;
      continue;
    }

    if (remainingDropoffs.size > 0) {
      const next = pickDropoffTarget([...remainingDropoffs.keys()]);
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

    // No dropoffs left: mop up locations with a genuine uncollected return
    // (surplus-available-only locations are never a reason to visit on
    // their own — see returnOnlySpots()). Anything else collectible at
    // the same stop rides along via doPickup, same as any other visit.
    const unvisitedReturns = returnOnlySpots();
    if (unvisitedReturns.length > 0) {
      const next = nearestInOptimalOrder(snapshot, currentLocation, unvisitedReturns);
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

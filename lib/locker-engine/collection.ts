import { DEFAULT_ROUTING_HORIZON_MINUTES, isNeededSoon } from "./bookingWindow";
import type { FleetSnapshot } from "./types";

/**
 * Collected unconditionally — a returned camera can't fulfill any booking
 * (confirmed or not) until it's been inspected, so there's never a reason
 * to leave one behind.
 */
const ALWAYS_COLLECT_STATUSES = ["RETURNED_AWAITING_INSPECTION"] as const;

/** Collected only if nothing confirmed needs them at this location soon. */
const COLLECT_IF_NOT_NEEDED_STATUSES = ["AVAILABLE"] as const;

/**
 * Which cameras currently positioned at `partnerId` the worker should pick
 * up on this visit: every returned-but-uninspected camera, plus every
 * AVAILABLE camera that isn't covering a confirmed booking in the next
 * `horizonMinutes` (default 3hr, matching the routing horizon elsewhere in
 * the engine) at this same location. Pure query — callers decide when to
 * actually apply it via `collectCamerasAtPartner`.
 */
export function selectCamerasForCollection(
  snapshot: FleetSnapshot,
  partnerId: string,
  now: Date = new Date(),
  horizonMinutes: number = DEFAULT_ROUTING_HORIZON_MINUTES
): string[] {
  return snapshot.assets
    .filter((a) => a.partnerId === partnerId)
    .filter((a) => {
      if ((ALWAYS_COLLECT_STATUSES as readonly string[]).includes(a.status)) return true;
      if ((COLLECT_IF_NOT_NEEDED_STATUSES as readonly string[]).includes(a.status)) {
        return !isNeededSoon(snapshot, a.id, now, horizonMinutes);
      }
      return false;
    })
    .map((a) => a.id);
}

/**
 * Applies the collection decision: every selected camera's position is
 * cleared to null (the existing "carried by the worker, not at a fixed
 * location" convention — the same one the hot spare uses at rest).
 */
export function collectCamerasAtPartner(
  snapshot: FleetSnapshot,
  partnerId: string,
  now: Date = new Date(),
  horizonMinutes: number = DEFAULT_ROUTING_HORIZON_MINUTES
): { snapshot: FleetSnapshot; collectedAssetIds: string[] } {
  const collectedAssetIds = selectCamerasForCollection(snapshot, partnerId, now, horizonMinutes);
  const collected = new Set(collectedAssetIds);
  return {
    snapshot: {
      ...snapshot,
      assets: snapshot.assets.map((a) => (collected.has(a.id) ? { ...a, partnerId: null } : a)),
    },
    collectedAssetIds,
  };
}

import { isTerminal } from "@/lib/state-machine/booking";
import type { EngineAsset, FleetSnapshot } from "./types";

/**
 * How far ahead the routing engine actively plans (brief: 2-3hr active-
 * routing horizon). A camera with a confirmed booking inside this window is
 * "needed soon" and must not be pulled into hot-spare duty; one further out
 * is still a legitimate candidate today — feasibility gets re-checked
 * continuously as the horizon rolls forward.
 */
export const DEFAULT_ROUTING_HORIZON_MINUTES = 180;

export class AssetNotFoundError extends Error {
  constructor(assetId: string) {
    super(`Asset ${assetId} not found in snapshot`);
    this.name = "AssetNotFoundError";
  }
}

export class NotHotSpareEligibleError extends Error {
  constructor(assetId: string, reason: string) {
    super(`Asset ${assetId} is not eligible to become the hot spare: ${reason}`);
    this.name = "NotHotSpareEligibleError";
  }
}

export class AssetNotFailedError extends Error {
  constructor(assetId: string, status: string) {
    super(`Asset ${assetId} is not in a failed state (status: ${status}) — expected MAINTENANCE or LOST`);
    this.name = "AssetNotFailedError";
  }
}

function getAsset(snapshot: FleetSnapshot, assetId: string): EngineAsset {
  const asset = snapshot.assets.find((a) => a.id === assetId);
  if (!asset) throw new AssetNotFoundError(assetId);
  return asset;
}

function withAsset(snapshot: FleetSnapshot, assetId: string, patch: Partial<EngineAsset>): FleetSnapshot {
  return {
    ...snapshot,
    assets: snapshot.assets.map((a) => (a.id === assetId ? { ...a, ...patch } : a)),
  };
}

/** Whether `assetId` has a non-terminal booking overlapping [now, now + horizon]. */
function isNeededSoon(snapshot: FleetSnapshot, assetId: string, now: Date, horizonMinutes: number): boolean {
  const horizonEnd = new Date(now.getTime() + horizonMinutes * 60_000);
  return snapshot.bookings.some(
    (b) => b.assetId === assetId && !isTerminal(b.status) && b.startTime < horizonEnd && b.endTime > now
  );
}

/** The spare gets deployed to cover a failed camera's slot — it stops being the spare. */
export function demoteHotSpare(snapshot: FleetSnapshot, assetId: string): FleetSnapshot {
  const asset = getAsset(snapshot, assetId);
  if (!asset.isHotSpare) {
    throw new NotHotSpareEligibleError(assetId, "asset is not currently the hot spare");
  }
  return withAsset(snapshot, assetId, { isHotSpare: false });
}

/**
 * Flags `assetId` as the hot spare. Only a camera that's physically
 * AVAILABLE right now and free of any booking inside the active routing
 * horizon qualifies — promoting a camera a customer needs soon would just
 * create a new version of the same problem this rule exists to prevent.
 */
export function promoteToHotSpare(
  snapshot: FleetSnapshot,
  assetId: string,
  now: Date = new Date(),
  horizonMinutes: number = DEFAULT_ROUTING_HORIZON_MINUTES
): FleetSnapshot {
  const asset = getAsset(snapshot, assetId);
  if (asset.isHotSpare) {
    throw new NotHotSpareEligibleError(assetId, "asset is already the hot spare");
  }
  if (asset.status !== "AVAILABLE") {
    throw new NotHotSpareEligibleError(assetId, `asset status is ${asset.status}, must be AVAILABLE`);
  }
  if (isNeededSoon(snapshot, assetId, now, horizonMinutes)) {
    throw new NotHotSpareEligibleError(assetId, "asset has a booking within the active routing horizon");
  }
  return withAsset(snapshot, assetId, { isHotSpare: true });
}

/**
 * Picks the best candidate to become the new hot spare: sellable, AVAILABLE,
 * and free of any booking inside the routing horizon. Deterministic
 * ordering (by human_id) rather than "first in array order" so the choice
 * is stable and testable. Returns null if nothing qualifies — the fleet
 * simply runs without a spare until one frees up, rather than force-
 * promoting a camera a booking is about to need.
 */
export function selectReplacementHotSpare(
  snapshot: FleetSnapshot,
  now: Date = new Date(),
  horizonMinutes: number = DEFAULT_ROUTING_HORIZON_MINUTES,
  excludeAssetIds: string[] = []
): string | null {
  const candidates = snapshot.assets
    .filter((a) => !excludeAssetIds.includes(a.id))
    .filter((a) => !a.isHotSpare && a.status === "AVAILABLE")
    .filter((a) => !isNeededSoon(snapshot, a.id, now, horizonMinutes))
    .sort((a, b) => a.humanId.localeCompare(b.humanId));
  return candidates[0]?.id ?? null;
}

export type HotSpareFailureEvent =
  | { type: "HOT_SPARE_DEPLOYED"; deployedAssetId: string; replacingAssetId: string }
  | { type: "HOT_SPARE_REPLACED"; newHotSpareAssetId: string }
  | { type: "NO_REPLACEMENT_AVAILABLE" };

/**
 * The full failure-response sequence: when `failedAssetId` goes down
 * (caller has already transitioned its asset status to MAINTENANCE/LOST)
 * and the fleet currently has a hot spare, the spare is deployed to cover
 * the failed camera's position, then the engine looks for a replacement
 * spare among the rest of the fleet — skipping the just-deployed unit
 * itself (it's now serving that position, not available to double as the
 * spare again) and any camera a confirmed booking needs soon. A no-op if
 * there's currently no hot spare to redeploy.
 */
export function handleAssetFailure(
  snapshot: FleetSnapshot,
  failedAssetId: string,
  now: Date = new Date(),
  horizonMinutes: number = DEFAULT_ROUTING_HORIZON_MINUTES
): { snapshot: FleetSnapshot; events: HotSpareFailureEvent[] } {
  const currentSpare = snapshot.assets.find((a) => a.isHotSpare);
  if (!currentSpare) {
    return { snapshot, events: [] };
  }

  const failedAsset = getAsset(snapshot, failedAssetId);
  if (failedAsset.status !== "MAINTENANCE" && failedAsset.status !== "LOST") {
    throw new AssetNotFailedError(failedAssetId, failedAsset.status);
  }

  const events: HotSpareFailureEvent[] = [];
  let next = demoteHotSpare(snapshot, currentSpare.id);
  next = withAsset(next, currentSpare.id, { partnerId: failedAsset.partnerId });
  events.push({ type: "HOT_SPARE_DEPLOYED", deployedAssetId: currentSpare.id, replacingAssetId: failedAssetId });

  const replacementId = selectReplacementHotSpare(next, now, horizonMinutes, [currentSpare.id]);
  if (replacementId) {
    next = promoteToHotSpare(next, replacementId, now, horizonMinutes);
    events.push({ type: "HOT_SPARE_REPLACED", newHotSpareAssetId: replacementId });
  } else {
    events.push({ type: "NO_REPLACEMENT_AVAILABLE" });
  }

  return { snapshot: next, events };
}

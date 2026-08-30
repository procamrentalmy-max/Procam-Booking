import type { AssetStatus } from "@/lib/db/types";

/**
 * Allowed rental-asset status transitions (spec section 7 / plan section 3).
 * Shared by every physical rental product (Insta360 camera, SeaLife
 * housing, ...) — a product doesn't get its own state machine, just its own
 * data (packages, condition-check templates, etc.) layered on top of this.
 *
 * RESERVED -> READY_FOR_PICKUP is time-based and automatic (fires when a
 * booking's start_time arrives); reception never "prepares" anything.
 *
 * On DAMAGE, the asset moves to MAINTENANCE by default rather than
 * continuing through the fleet — a possibly-damaged unit never becomes
 * AVAILABLE without a staff member explicitly clearing it.
 */
export const ASSET_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
  AVAILABLE: ["RESERVED", "MAINTENANCE", "LOST", "RETIRED"],
  RESERVED: ["READY_FOR_PICKUP", "AVAILABLE" /* booking cancelled/expired */, "LOST", "RETIRED"],
  READY_FOR_PICKUP: ["RENTED", "AVAILABLE" /* booking cancelled */, "LOST", "RETIRED"],
  RENTED: ["RETURNED_AWAITING_INSPECTION", "LOST", "RETIRED"],
  RETURNED_AWAITING_INSPECTION: ["INSPECTION", "LOST", "RETIRED"],
  INSPECTION: ["CLEANING", "MAINTENANCE", "LOST", "RETIRED"],
  CLEANING: ["CHARGING", "MAINTENANCE", "LOST", "RETIRED"],
  CHARGING: ["AVAILABLE", "MAINTENANCE", "LOST", "RETIRED"],
  MAINTENANCE: ["AVAILABLE", "LOST", "RETIRED"],
  LOST: ["MAINTENANCE", "RETIRED"],
  RETIRED: [],
};

export const ALL_ASSET_STATUSES = Object.keys(ASSET_TRANSITIONS) as AssetStatus[];

export class InvalidAssetTransitionError extends Error {
  constructor(from: AssetStatus, to: AssetStatus) {
    super(`Asset cannot transition from ${from} to ${to}`);
    this.name = "InvalidAssetTransitionError";
  }
}

export function assertValidAssetTransition(from: AssetStatus, to: AssetStatus): void {
  if (!ASSET_TRANSITIONS[from].includes(to)) {
    throw new InvalidAssetTransitionError(from, to);
  }
}

/** LOST and RETIRED are admin-only regardless of the current status. */
export function requiresAdmin(to: AssetStatus): boolean {
  return to === "LOST" || to === "RETIRED";
}

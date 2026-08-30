import type { CameraStatus } from "@/lib/db/types";

/**
 * Allowed camera status transitions (spec section 7 / plan section 3).
 *
 * RESERVED -> READY_FOR_PICKUP is time-based and automatic (fires when a
 * booking's start_time arrives); reception never "prepares" a camera.
 *
 * On DAMAGE, the camera moves to MAINTENANCE by default rather than
 * continuing through the fleet — a possibly-damaged unit never becomes
 * AVAILABLE without a staff member explicitly clearing it.
 */
export const CAMERA_TRANSITIONS: Record<CameraStatus, CameraStatus[]> = {
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

export const ALL_CAMERA_STATUSES = Object.keys(CAMERA_TRANSITIONS) as CameraStatus[];

export class InvalidCameraTransitionError extends Error {
  constructor(from: CameraStatus, to: CameraStatus) {
    super(`Camera cannot transition from ${from} to ${to}`);
    this.name = "InvalidCameraTransitionError";
  }
}

export function assertValidCameraTransition(from: CameraStatus, to: CameraStatus): void {
  if (!CAMERA_TRANSITIONS[from].includes(to)) {
    throw new InvalidCameraTransitionError(from, to);
  }
}

/** LOST and RETIRED are admin-only regardless of the current status. */
export function requiresAdmin(to: CameraStatus): boolean {
  return to === "LOST" || to === "RETIRED";
}

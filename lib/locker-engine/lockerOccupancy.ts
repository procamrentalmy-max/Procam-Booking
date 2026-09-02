import type { EngineCompartment, FleetSnapshot } from "./types";

export class CompartmentNotFoundError extends Error {
  constructor(compartmentId: string) {
    super(`Compartment ${compartmentId} not found in snapshot`);
    this.name = "CompartmentNotFoundError";
  }
}

export class CompartmentOccupiedError extends Error {
  constructor(compartmentId: string, currentAssetId: string) {
    super(`Compartment ${compartmentId} is already occupied by asset ${currentAssetId}`);
    this.name = "CompartmentOccupiedError";
  }
}

export class AssetAlreadyInLockerError extends Error {
  constructor(assetId: string, compartmentId: string) {
    super(`Asset ${assetId} is already assigned to compartment ${compartmentId}`);
    this.name = "AssetAlreadyInLockerError";
  }
}

export class CompartmentEmptyError extends Error {
  constructor(compartmentId: string) {
    super(`Compartment ${compartmentId} is already empty`);
    this.name = "CompartmentEmptyError";
  }
}

function getCompartment(snapshot: FleetSnapshot, compartmentId: string): EngineCompartment {
  const compartment = snapshot.compartments.find((c) => c.id === compartmentId);
  if (!compartment) throw new CompartmentNotFoundError(compartmentId);
  return compartment;
}

/** A worker physically loaded `assetId` into `compartmentId` and set its PIN. */
export function assignAssetToCompartment(
  snapshot: FleetSnapshot,
  compartmentId: string,
  assetId: string
): FleetSnapshot {
  const target = getCompartment(snapshot, compartmentId);
  if (target.currentAssetId) {
    throw new CompartmentOccupiedError(compartmentId, target.currentAssetId);
  }
  const existing = snapshot.compartments.find((c) => c.currentAssetId === assetId);
  if (existing) {
    throw new AssetAlreadyInLockerError(assetId, existing.id);
  }
  return {
    ...snapshot,
    compartments: snapshot.compartments.map((c) =>
      c.id === compartmentId ? { ...c, currentAssetId: assetId } : c
    ),
  };
}

/** The customer picked up (or a worker pulled) the camera — the compartment is now empty. */
export function releaseCompartment(snapshot: FleetSnapshot, compartmentId: string): FleetSnapshot {
  const target = getCompartment(snapshot, compartmentId);
  if (!target.currentAssetId) {
    throw new CompartmentEmptyError(compartmentId);
  }
  return {
    ...snapshot,
    compartments: snapshot.compartments.map((c) =>
      c.id === compartmentId ? { ...c, currentAssetId: null } : c
    ),
  };
}

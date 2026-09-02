import type { AssetStatus, BookingStatus } from "@/lib/db/types";

/**
 * A read-only, decoupled-from-Supabase snapshot of the fleet at a moment in
 * time. Every engine function is a pure function over this shape — no
 * database calls, no side effects — so the whole locker/routing engine can
 * be exercised directly by unit tests (see plan doc, Engine layer). The
 * wiring layer (later phase) is responsible for building this from real
 * Supabase rows and persisting whatever comes back out.
 */
export type EngineAsset = {
  id: string;
  humanId: string;
  isHotSpare: boolean;
  partnerId: string | null;
  status: AssetStatus;
};

export type EngineBooking = {
  id: string;
  assetId: string;
  status: BookingStatus;
  startTime: Date;
  endTime: Date;
};

export type EngineCompartment = {
  id: string;
  lockerId: string;
  compartmentNumber: number;
  currentAssetId: string | null;
};

export type EngineWorker = {
  id: string;
  currentPartnerId: string | null;
  active: boolean;
};

export type FleetSnapshot = {
  assets: EngineAsset[];
  bookings: EngineBooking[];
  compartments: EngineCompartment[];
  workers: EngineWorker[];
};

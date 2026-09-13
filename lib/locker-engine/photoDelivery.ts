import { DEFAULT_TRAVEL_MINUTES, type RouteStop } from "./routing";
import type { FleetSnapshot } from "./types";

export type PhotoDelivery = {
  id: string;
  customerName: string;
  size: string;
  quantity: number;
  /** Assigned already, at print time (lib/photoPrint/printQueue.ts) — null means the wooden box, not a numbered slot. */
  slotNumber: number | null;
};

function travelMinutesBetween(snapshot: FleetSnapshot, from: string | null, to: string): number {
  if (from === null || from === to) return 0;
  const entry = snapshot.travelTimes.find((t) => t.fromPartnerId === from && t.toPartnerId === to);
  return entry?.minutes ?? DEFAULT_TRAVEL_MINUTES;
}

function nearestPartnerId(snapshot: FleetSnapshot, from: string | null, partnerIds: string[]): string | null {
  if (partnerIds.length === 0) return null;
  return partnerIds.reduce((best, id) =>
    travelMinutesBetween(snapshot, from, id) < travelMinutesBetween(snapshot, from, best) ? id : best
  );
}

/**
 * Decides which partner the worker should actually go to right now, and
 * whether that's the camera engine's own planned stop.
 *
 * A confirmed-booking dropoff due within the next hour or two always wins
 * outright — that's planRoute's own top priority (routing.ts), untouched
 * here. Only once there's no such urgency left does a photo delivery get
 * to compete for "next stop" at all, on equal footing with whatever
 * return-only camera pickup planRoute would otherwise send the worker to
 * next — nearest one wins, same tie-break the camera engine itself uses.
 * This is what makes "next-hour cameras, then next-2-hour cameras, then
 * photos alongside returns" (the agreed priority order) fall out correctly
 * without needing to touch planRoute's own tier logic at all.
 */
export function chooseStop(
  snapshot: FleetSnapshot,
  currentPartnerId: string | null,
  plannedStop: RouteStop | null,
  photoDeliveriesByPartner: Map<string, PhotoDelivery[]>
): { partnerId: string; fromPlan: boolean } | null {
  const plannedIsUrgentDropoff = plannedStop?.actions.some((a) => a.type === "DROPOFF") ?? false;
  if (plannedIsUrgentDropoff && plannedStop) return { partnerId: plannedStop.partnerId, fromPlan: true };

  const candidates = new Set<string>(photoDeliveriesByPartner.keys());
  if (plannedStop) candidates.add(plannedStop.partnerId);
  const chosen = nearestPartnerId(snapshot, currentPartnerId, [...candidates]);
  if (!chosen) return null;
  return { partnerId: chosen, fromPlan: chosen === plannedStop?.partnerId };
}

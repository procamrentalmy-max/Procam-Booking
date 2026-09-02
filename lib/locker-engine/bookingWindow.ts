import { isTerminal } from "@/lib/state-machine/booking";
import type { FleetSnapshot } from "./types";

/**
 * How far ahead the routing engine actively plans (brief: 2-3hr active-
 * routing horizon). Shared by every "is this camera about to be needed"
 * check across the engine — hot-spare promotion and worker collection both
 * mean the same thing by "needed soon."
 */
export const DEFAULT_ROUTING_HORIZON_MINUTES = 180;

/**
 * Whether `assetId` has a non-terminal booking overlapping [now, now +
 * horizon]. Boundary-inclusive: a booking starting at exactly the horizon
 * edge still counts as "needed soon" — better to protect a borderline
 * booking than to sweep up a camera an instant before it's due.
 */
export function isNeededSoon(
  snapshot: FleetSnapshot,
  assetId: string,
  now: Date,
  horizonMinutes: number = DEFAULT_ROUTING_HORIZON_MINUTES
): boolean {
  const horizonEnd = new Date(now.getTime() + horizonMinutes * 60_000);
  return snapshot.bookings.some(
    (b) => b.assetId === assetId && !isTerminal(b.status) && b.startTime <= horizonEnd && b.endTime > now
  );
}

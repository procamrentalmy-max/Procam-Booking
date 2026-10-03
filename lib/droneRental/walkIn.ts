import type { DrWalkInStatus } from "@/lib/db/types";

/**
 * How long a walk-in order waits for the merchant to confirm it. Long enough for the merchant to get to it, short
 * enough that an order from someone who has since left can't be confirmed (and a drone tied up) much later.
 */
export const WALKIN_REQUEST_TTL_MINUTES = 15;

/** What the request looks like right now: the stored status, except that an unconfirmed order past its expiry reads as EXPIRED. */
export type WalkInView = DrWalkInStatus | "EXPIRED";

export function walkInExpiry(now: Date): Date {
  return new Date(now.getTime() + WALKIN_REQUEST_TTL_MINUTES * 60_000);
}

export function walkInView(status: DrWalkInStatus, expiresAt: Date, now: Date): WalkInView {
  const stillOpen = status === "WAITING" || status === "SUBMITTED";
  return stillOpen && expiresAt.getTime() <= now.getTime() ? "EXPIRED" : status;
}

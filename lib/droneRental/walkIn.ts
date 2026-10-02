import type { DrWalkInStatus } from "@/lib/db/types";

/**
 * How long a walk-in QR stays usable. Long enough to scan, type three
 * fields and for the merchant to accept; short enough that a forgotten QR
 * can't be filled in an hour later by someone who photographed it.
 */
export const WALKIN_REQUEST_TTL_MINUTES = 15;

/** What the request looks like right now: the stored status, except that an unaccepted request past its expiry reads as EXPIRED. */
export type WalkInView = DrWalkInStatus | "EXPIRED";

export function walkInExpiry(now: Date): Date {
  return new Date(now.getTime() + WALKIN_REQUEST_TTL_MINUTES * 60_000);
}

export function walkInView(status: DrWalkInStatus, expiresAt: Date, now: Date): WalkInView {
  const stillOpen = status === "WAITING" || status === "SUBMITTED";
  return stillOpen && expiresAt.getTime() <= now.getTime() ? "EXPIRED" : status;
}

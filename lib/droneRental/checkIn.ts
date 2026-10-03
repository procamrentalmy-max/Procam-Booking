import type { DrBookingStatus } from "@/lib/db/types";

/**
 * What a merchant sees when they scan a customer's booking QR.
 *
 * - READY: paid, not yet accepted — show Accept order / Cancel.
 * - ALREADY_ACCEPTED: the QR has been used (accepted, or the rental has moved on) — it does nothing now.
 * - NOT_PAID / CLOSED: nothing to accept yet, or ever.
 *
 * "Cancel" on the READY screen changes nothing, so scanning again shows the same screen.
 */
export type CheckInView = "READY" | "ALREADY_ACCEPTED" | "NOT_PAID" | "CLOSED";

export function checkInView(booking: { status: DrBookingStatus; checked_in_at: string | null }): CheckInView {
  if (booking.status === "PENDING_PAYMENT") return "NOT_PAID";
  if (booking.status === "CANCELLED" || booking.status === "EXPIRED") return "CLOSED";
  if (booking.checked_in_at || booking.status === "ACTIVE" || booking.status === "COMPLETED") return "ALREADY_ACCEPTED";
  return "READY";
}

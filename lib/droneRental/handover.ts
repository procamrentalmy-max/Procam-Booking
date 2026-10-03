import { RETURN_BUFFER_MINUTES, alignToNextInterval } from "./slots";
import type { DrBookingSource } from "@/lib/db/types";

export type HandoverWindow = {
  start: Date;
  end: Date;
  /** Minutes the rental had to be cut short of the paid length because another booking follows closely. 0 almost always. */
  shortenedByMinutes: number;
};

/**
 * The rental window to record when the merchant confirms the handover.
 *
 * Online bookings are for a fixed slot the customer picked, so the window
 * stays exactly as booked.
 *
 * A walk-in's rental officially starts at handover, not when the booking was
 * created (the customer still has to fill in details, the merchant accept,
 * and payment go through first). The start is the handover moment, and the
 * return time is that plus the paid duration, rounded UP to the next
 * 30-minute mark (e.g. handed over 13:14 for 1 hour: return by 14:30). Only
 * the resulting time is ever shown; the rounding itself isn't mentioned.
 *
 * The booking reserved the drone from the moment it was created, so the end
 * can land later than what was reserved; it's capped to leave the usual
 * return buffer before the drone's next booking. If that cap leaves the
 * customer with less than the time they paid for, the shortfall is reported
 * so the merchant can tell them. The end is never earlier than what was
 * reserved.
 */
export function computeHandoverWindow(params: {
  source: DrBookingSource;
  start: Date;
  end: Date;
  handoverAt: Date;
  /** Start of the drone's next live booking after this one, if any. */
  nextStart: Date | null;
}): HandoverWindow {
  const { source, start, end, handoverAt, nextStart } = params;
  if (source !== "MERCHANT_INSTANT") return { start, end, shortenedByMinutes: 0 };

  // At creation a walk-in reserves exactly start + the paid duration, so the paid length is recoverable from the reserved window.
  const paidMs = end.getTime() - start.getTime();
  const newStart = handoverAt > start ? handoverAt : start;
  const paidEnd = new Date(newStart.getTime() + paidMs);
  const wantedEnd = alignToNextInterval(paidEnd);

  let newEnd = wantedEnd;
  if (nextStart) {
    const latestEnd = new Date(nextStart.getTime() - RETURN_BUFFER_MINUTES * 60_000);
    if (wantedEnd > latestEnd) newEnd = latestEnd > end ? latestEnd : end;
  }

  return { start: newStart, end: newEnd, shortenedByMinutes: Math.max(0, Math.round((paidEnd.getTime() - newEnd.getTime()) / 60_000)) };
}

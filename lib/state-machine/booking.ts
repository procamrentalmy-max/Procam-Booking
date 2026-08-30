import type { BookingStatus } from "@/lib/db/types";

/**
 * Allowed booking status transitions (plan section 3).
 *
 * Kept distinct from camera status: a booking in DAMAGE_REVIEW says nothing
 * about whether its camera is AVAILABLE, MAINTENANCE, etc. — those are two
 * separate questions with two separate state machines.
 */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING_PAYMENT: ["CONFIRMED", "CANCELLED", "EXPIRED"],
  CONFIRMED: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["RETURN_STARTED"],
  RETURN_STARTED: ["AWAITING_INSPECTION"],
  AWAITING_INSPECTION: ["INSPECTION"],
  INSPECTION: ["COMPLETED", "DAMAGE_REVIEW"],
  DAMAGE_REVIEW: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export class InvalidBookingTransitionError extends Error {
  constructor(from: BookingStatus, to: BookingStatus) {
    super(`Booking cannot transition from ${from} to ${to}`);
    this.name = "InvalidBookingTransitionError";
  }
}

export function assertValidBookingTransition(from: BookingStatus, to: BookingStatus): void {
  if (!BOOKING_TRANSITIONS[from].includes(to)) {
    throw new InvalidBookingTransitionError(from, to);
  }
}

/** A camera/deposit hold is live for any status except these terminal ones. */
export const TERMINAL_BOOKING_STATUSES: BookingStatus[] = ["CANCELLED", "EXPIRED", "COMPLETED"];

export function isTerminal(status: BookingStatus): boolean {
  return TERMINAL_BOOKING_STATUSES.includes(status);
}

/** How long a booking may sit in PENDING_PAYMENT before it auto-expires. */
export const PENDING_PAYMENT_TIMEOUT_MINUTES = 10;

/**
 * How close to its scheduled start_time a booking has to be before its
 * camera gets flagged RESERVED/READY_FOR_PICKUP. Bookings further out than
 * this stay at CONFIRMED with their camera untouched — otherwise a camera
 * booked for next Tuesday would show as "reserved" (and be hidden from
 * other customers' availability search) starting the moment it was paid
 * for, not when it's actually needed.
 */
export const IMMINENT_START_THRESHOLD_MINUTES = 15;

export function isImminent(startTime: Date, now: Date = new Date()): boolean {
  return startTime.getTime() - now.getTime() <= IMMINENT_START_THRESHOLD_MINUTES * 60_000;
}

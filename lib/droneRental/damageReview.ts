import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { resolveDroneDeposit } from "./payment";
import {
  DepositCaptureError,
  computeDepositCapture,
  includesController,
  modelProfile,
  storedController,
  type ItemReturn,
} from "./pricingRules";

export class DamageReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DamageReviewError";
  }
}

/** What one item looks like to the reviewer: a damaged item gets the amount typed for it, a lost one is charged in full, anything else nothing. */
function reviewedItem(outcome: string, amountMyr: number | undefined): ItemReturn {
  if (outcome === "LOST") return { outcome: "LOST" };
  if (outcome === "DAMAGED" && amountMyr !== undefined && amountMyr > 0) return { outcome: "DAMAGED", damageMyr: amountMyr };
  return { outcome: "NONE" };
}

/**
 * The nightly review of a returned drone that had something damaged. The deposit has been held on the customer's card since the
 * return; this works out what to keep from the amounts the admin typed for each damaged item (a lost item is kept in full, a damaged
 * item with 0 typed is not charged), captures exactly that from the hold through Stripe, and releases the rest.
 *
 * Stripe takes one capture per hold, so this is the only place the deposit is settled for a booking that is waiting for review.
 */
export async function reviewDroneDamage(params: {
  bookingId: string;
  droneAmountMyr?: number;
  controllerAmountMyr?: number;
  reviewedByStaffId: string;
}): Promise<{ capturedMyr: number; holdFound: boolean }> {
  const supabase = createServiceRoleClient();
  const { data: booking } = await supabase
    .from("dr_bookings")
    .select("id,status,damage_review,drone_model,controller_kind,drone_outcome,controller_outcome")
    .eq("id", params.bookingId)
    .single();
  if (!booking) throw new DamageReviewError("Booking not found.");
  if (booking.damage_review !== "PENDING") throw new DamageReviewError("This booking isn't waiting for a damage review.");

  const profile = modelProfile(booking.drone_model);
  const controller = storedController(booking.drone_model, booking.controller_kind);
  const withController = includesController(booking.drone_model, controller);

  let capture;
  try {
    capture = computeDepositCapture(
      reviewedItem(booking.drone_outcome, params.droneAmountMyr),
      reviewedItem(withController ? booking.controller_outcome : "NONE", params.controllerAmountMyr),
      profile.key,
      controller
    );
  } catch (err) {
    if (err instanceof DepositCaptureError) throw new DamageReviewError(err.message);
    throw err;
  }

  // Claim the review first so two clicks (or two admins) can't capture twice.
  const { data: claimed } = await supabase
    .from("dr_bookings")
    .update({ damage_review: "DONE", damage_reviewed_at: new Date().toISOString() })
    .eq("id", params.bookingId)
    .eq("damage_review", "PENDING")
    .select("id");
  if (!claimed || claimed.length === 0) throw new DamageReviewError("This review was already done.");

  try {
    const { holdFound } = await resolveDroneDeposit({
      bookingId: params.bookingId,
      capture,
      droneOutcome: booking.drone_outcome,
      controllerOutcome: withController ? booking.controller_outcome : "NONE",
      resolvedByStaffId: params.reviewedByStaffId,
    });
    return { capturedMyr: capture.totalMyr, holdFound };
  } catch (err) {
    // Stripe failed: put it back in the list so it can be tried again.
    await supabase.from("dr_bookings").update({ damage_review: "PENDING", damage_reviewed_at: null }).eq("id", params.bookingId);
    throw err;
  }
}

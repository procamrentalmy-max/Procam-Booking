import "server-only";
import { randomBytes } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { buildLockerFleetSnapshot } from "./lockerSnapshot";
import {
  checkLockerBookingFeasibility,
  checkOvernightBookingFeasibility,
  InvalidBookingRequestError,
} from "@/lib/locker-engine/bookingGate";
import { isImminent } from "@/lib/state-machine/booking";
import type { BookingRow, BookingSource } from "@/lib/db/types";

export { InvalidBookingRequestError };

export class NoAssetAvailableError extends Error {
  constructor() {
    super("No equipment is available for that time and location.");
    this.name = "NoAssetAvailableError";
  }
}

function generateSecureToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Every partner is a self-service locker now — there's no separately
 * tracked "kit" (see 0011_remove_kits.sql), just the camera itself, and the
 * candidate camera comes from the pooled fleet-wide search
 * (checkLockerBookingFeasibility / checkOvernightBookingFeasibility)
 * rather than "whatever's sitting at this exact property."
 *
 * The customer's requested time is a request, not a guarantee — the
 * actual assigned startTime/endTime (returned here) may be later if the
 * exact hour isn't feasible. The booking's own row is the source of
 * truth for what was actually granted; the caller should surface that,
 * not just echo back what was asked for.
 */
export async function createPendingLockerBooking(params: {
  customerId: string;
  partnerId: string;
  rentalPackageId: string;
  earliestStartTime: Date;
  source: BookingSource;
  referralCode: string | null;
}): Promise<BookingRow> {
  const supabase = createServiceRoleClient();

  const { data: pkg } = await supabase
    .from("rental_packages")
    .select("product_id,duration_minutes,active,is_overnight")
    .eq("id", params.rentalPackageId)
    .single();
  if (!pkg || !pkg.active) throw new Error("This rental package is no longer available.");

  const { data: partner } = await supabase
    .from("partners")
    .select("status,pickup_method")
    .eq("id", params.partnerId)
    .single();
  if (!partner || partner.status !== "ACTIVE") throw new Error("This property is not currently active.");
  if (partner.pickup_method !== "LOCKER") throw new Error("This location isn't a self-service locker.");

  const snapshot = await buildLockerFleetSnapshot(pkg.product_id);

  const result = pkg.is_overnight
    ? checkOvernightBookingFeasibility(snapshot, { partnerId: params.partnerId, earliestNight: params.earliestStartTime })
    : checkLockerBookingFeasibility(snapshot, {
        partnerId: params.partnerId,
        durationMinutes: pkg.duration_minutes,
        earliestStartTime: params.earliestStartTime,
      });

  if (result.outcome === "INFEASIBLE") throw new NoAssetAvailableError();

  // The RPC (0012_worker_schedule_lock.sql) is the real backstop, not this
  // insert: it takes a global advisory lock and re-validates worker-schedule
  // feasibility against the DB's actual current state before inserting, all
  // inside one transaction — closing the race where two concurrent callers
  // each pass the check above against a snapshot that doesn't include the
  // other. The inventory half of the gate was already backed by the
  // asset/kit EXCLUDE constraints; this closes the worker-schedule half.
  const { data: booking, error } = await supabase
    .rpc("create_locker_booking_atomic", {
      p_customer_id: params.customerId,
      p_partner_id: params.partnerId,
      p_rental_package_id: params.rentalPackageId,
      p_asset_id: result.assetId,
      p_start_time: result.startTime.toISOString(),
      p_end_time: result.endTime.toISOString(),
      p_secure_token: generateSecureToken(),
      p_source: params.source,
      p_referral_code: params.referralCode,
    });

  if (error) {
    // 23P01 = exclusion_violation (asset/kit double-booked — a concurrent
    // booking won the race between our read and this write). P0001 = the
    // RPC's own "INFEASIBLE: ..." raises for a worker-schedule conflict.
    // Both mean the same thing to the customer: this slot didn't actually
    // work out, not a real system error.
    if (error.code === "23P01" || error.code === "P0001") throw new NoAssetAvailableError();
    throw new Error(error.message);
  }
  if (!booking) throw new Error("Booking creation did not return a row.");

  if (!pkg.is_overnight && isImminent(result.startTime)) {
    const { error: transitionError } = await supabase.rpc("system_transition_asset_status", {
      p_asset_id: result.assetId,
      p_to_status: "RESERVED",
      p_actor_type: "CUSTOMER",
      p_booking_id: booking.id,
      p_event_type: "BOOKING_CREATED",
    });

    if (transitionError) {
      await supabase.from("bookings").delete().eq("id", booking.id);
      throw new Error(transitionError.message);
    }
  }

  return booking;
}

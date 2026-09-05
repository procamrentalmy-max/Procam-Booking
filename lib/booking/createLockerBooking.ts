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
 * The real, wired-up replacement for the old reception-era
 * createPendingBooking: every partner is a self-service locker now, so
 * there's no kit, and the candidate camera comes from the pooled
 * fleet-wide search (checkLockerBookingFeasibility /
 * checkOvernightBookingFeasibility) rather than "whatever's sitting at
 * this exact property."
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

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      secure_token: generateSecureToken(),
      customer_id: params.customerId,
      partner_id: params.partnerId,
      rental_package_id: params.rentalPackageId,
      asset_id: result.assetId,
      status: "PENDING_PAYMENT",
      start_time: result.startTime.toISOString(),
      end_time: result.endTime.toISOString(),
      source: params.source,
      referral_code: params.referralCode,
    })
    .select("*")
    .single();

  if (error) {
    // 23P01 = exclusion_violation: the snapshot was stale — a concurrent
    // booking took this exact camera/window between our read and this
    // write. The DB is the real backstop for that, same as the reception
    // model. The worker-schedule half of the gate has no equivalent
    // database-level enforcement yet (a known, deliberately deferred gap —
    // see the plan doc's advisory-lock serialization note); a race there
    // wouldn't surface as a constraint violation at all. Acceptable at
    // current traffic, not once real concurrent bookings are common.
    if (error.code === "23P01") throw new NoAssetAvailableError();
    throw new Error(error.message);
  }

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

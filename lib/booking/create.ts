import "server-only";
import { randomBytes } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { BookingRow, BookingSource } from "@/lib/db/types";

export class NoCameraAvailableError extends Error {
  constructor() {
    super("No camera is available at this property right now.");
    this.name = "NoCameraAvailableError";
  }
}

function generateSecureToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Creates a PENDING_PAYMENT booking with a camera+kit atomically assigned.
 *
 * "Atomic" here doesn't mean a single database transaction — it means the
 * booking INSERT is what actually decides the winner under concurrency,
 * because the EXCLUDE constraints on bookings(camera_id, ...) and
 * bookings(kit_id, ...) reject an overlapping insert outright (Postgres
 * error 23P01). We just try candidate camera/kit pairs until one insert
 * succeeds; there's no separate "reserve" step to race.
 */
export async function createPendingBooking(params: {
  customerId: string;
  partnerId: string;
  rentalPackageId: string;
  source: BookingSource;
  referralCode: string | null;
}): Promise<BookingRow> {
  const supabase = createServiceRoleClient();

  const { data: pkg } = await supabase
    .from("rental_packages")
    .select("duration_minutes,active")
    .eq("id", params.rentalPackageId)
    .single();
  if (!pkg || !pkg.active) throw new Error("This rental package is no longer available.");

  const { data: partner } = await supabase
    .from("partners")
    .select("status")
    .eq("id", params.partnerId)
    .single();
  if (!partner || partner.status !== "ACTIVE") throw new Error("This property is not currently active.");

  const [{ data: cameras }, { data: kits }] = await Promise.all([
    supabase.from("cameras").select("id").eq("partner_id", params.partnerId).eq("status", "AVAILABLE"),
    supabase.from("kits").select("id").eq("partner_id", params.partnerId).eq("status", "AVAILABLE"),
  ]);
  if (!cameras?.length || !kits?.length) throw new NoCameraAvailableError();

  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + pkg.duration_minutes * 60_000);

  for (const camera of cameras) {
    for (const kit of kits) {
      const { data: booking, error } = await supabase
        .from("bookings")
        .insert({
          secure_token: generateSecureToken(),
          customer_id: params.customerId,
          partner_id: params.partnerId,
          rental_package_id: params.rentalPackageId,
          camera_id: camera.id,
          kit_id: kit.id,
          status: "PENDING_PAYMENT",
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          source: params.source,
          referral_code: params.referralCode,
        })
        .select("*")
        .single();

      if (error) {
        // 23P01 = exclusion_violation: another request grabbed this camera
        // or kit in the gap between our SELECT and this INSERT. Try the
        // next candidate pair instead of failing the whole booking attempt.
        if (error.code === "23P01") continue;
        throw new Error(error.message);
      }

      const { error: transitionError } = await supabase.rpc("system_transition_camera_status", {
        p_camera_id: camera.id,
        p_to_status: "RESERVED",
        p_actor_type: "CUSTOMER",
        p_booking_id: booking.id,
        p_event_type: "BOOKING_CREATED",
      });

      if (transitionError) {
        // Don't leave a booking holding a camera that's still shown as
        // AVAILABLE everywhere else — undo and surface the failure.
        await supabase.from("bookings").delete().eq("id", booking.id);
        throw new Error(transitionError.message);
      }

      return booking;
    }
  }

  throw new NoCameraAvailableError();
}

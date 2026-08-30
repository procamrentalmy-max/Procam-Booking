"use server";

import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { uploadConditionPhoto, conditionPhotoPath } from "@/lib/storage";
import { assertValidBookingTransition } from "@/lib/state-machine/booking";
import { logAudit } from "@/lib/audit";
import type { BookingStatus, ConditionPhotoType } from "@/lib/db/types";

const PHOTO_FIELDS = ["screen_on", "lens_a", "lens_b", "kit_full"] as const;
const PHOTO_TYPE_MAP: Record<(typeof PHOTO_FIELDS)[number], ConditionPhotoType> = {
  screen_on: "SCREEN_ON",
  lens_a: "LENS_A",
  lens_b: "LENS_B",
  kit_full: "KIT_FULL",
};

/**
 * Completes the return condition check (spec section 14). Moves the
 * booking ACTIVE -> RETURN_STARTED — asset status does NOT change here.
 * It only becomes RETURNED_AWAITING_INSPECTION once reception physically
 * confirms receipt (app/reception/return/actions.ts); the deposit stays
 * held throughout, regardless of what the customer declares here.
 */
export async function submitReturnConditionCheckAction(formData: FormData) {
  const token = z.string().min(1).parse(formData.get("token"));
  const damageReported = formData.get("damageReported") === "true";
  const damageDescription = formData.get("damageDescription");

  const photos: Partial<Record<(typeof PHOTO_FIELDS)[number], File>> = {};
  for (const field of PHOTO_FIELDS) {
    const file = formData.get(field);
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("All four photos are required.");
    }
    photos[field] = file;
  }

  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id,status,asset_id")
    .eq("secure_token", token)
    .maybeSingle();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "ACTIVE") throw new Error("This booking isn't active.");

  const { data: check, error: checkError } = await supabase
    .from("condition_checks")
    .upsert(
      {
        booking_id: booking.id,
        asset_id: booking.asset_id,
        type: "RETURN",
        ack_powers_on: true,
        ack_no_damage: !damageReported,
        ack_accessories_present: true,
        damage_reported: damageReported,
        damage_description: damageReported && typeof damageDescription === "string" ? damageDescription : null,
      },
      { onConflict: "booking_id,type" }
    )
    .select("id")
    .single();
  if (checkError || !check) throw new Error("Could not save your condition check. Please try again.");

  for (const field of PHOTO_FIELDS) {
    const photoType = PHOTO_TYPE_MAP[field];
    const path = conditionPhotoPath(booking.id, "return", photoType);
    await uploadConditionPhoto(path, photos[field]!);
    await supabase
      .from("condition_photos")
      .upsert(
        { condition_check_id: check.id, photo_type: photoType, storage_path: path },
        { onConflict: "condition_check_id,photo_type" }
      );
  }

  assertValidBookingTransition(booking.status as BookingStatus, "RETURN_STARTED");

  const { error: bookingError } = await supabase
    .from("bookings")
    .update({ status: "RETURN_STARTED", actual_return_time: new Date().toISOString() })
    .eq("id", booking.id);
  if (bookingError) throw new Error(bookingError.message);

  await logAudit({
    actorType: "CUSTOMER",
    action: "RETURN_CHECK_COMPLETED",
    entityType: "booking",
    entityId: booking.id,
    before: { status: "ACTIVE" },
    after: { status: "RETURN_STARTED", damageReported },
  });
}

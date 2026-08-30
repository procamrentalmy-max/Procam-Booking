"use server";

import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { uploadConditionPhoto, conditionPhotoPath } from "@/lib/storage";
import { assertValidBookingTransition } from "@/lib/state-machine/booking";
import { promoteBookingToReadyForPickup } from "@/lib/booking/confirm";
import { logAudit } from "@/lib/audit";
import type { ConditionPhotoType } from "@/lib/db/types";

const PHOTO_FIELDS = ["screen_on", "lens_a", "lens_b", "kit_full"] as const;
const PHOTO_TYPE_MAP: Record<(typeof PHOTO_FIELDS)[number], ConditionPhotoType> = {
  screen_on: "SCREEN_ON",
  lens_a: "LENS_A",
  lens_b: "LENS_B",
  kit_full: "KIT_FULL",
};

/**
 * Completes the pre-rental condition check (spec section 10). This is the
 * one place a booking moves READY_FOR_PICKUP -> ACTIVE and its asset moves
 * READY_FOR_PICKUP -> RENTED — customers can't skip straight here without
 * a valid booking at the right status, and can't submit without all four
 * required photos and all three acknowledgements.
 */
export async function submitPreRentalConditionCheckAction(formData: FormData) {
  const token = z.string().min(1).parse(formData.get("token"));

  const ackPowersOn = formData.get("ackPowersOn") === "true";
  const ackNoDamage = formData.get("ackNoDamage") === "true";
  const ackAccessoriesPresent = formData.get("ackAccessoriesPresent") === "true";
  if (!ackPowersOn || !ackNoDamage || !ackAccessoriesPresent) {
    throw new Error("Please confirm all three checks before continuing.");
  }

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
    .select("id,status,asset_id,rental_package_id")
    .eq("secure_token", token)
    .maybeSingle();
  if (!booking) throw new Error("Booking not found.");
  // CONFIRMED is allowed too: a booking scheduled ahead only gets its
  // asset catch-up-promoted to READY_FOR_PICKUP by the housekeeping cron
  // as its start time approaches (see lib/booking/confirm.ts), which can
  // lag a guest showing up early. Reception can still physically hand over
  // the pouch (they look the booking up by code, not by asset status —
  // see app/reception/pickup/actions.ts), so the customer shouldn't be
  // blocked from their own condition check either.
  if (booking.status === "CONFIRMED") {
    await promoteBookingToReadyForPickup(booking.id);
  } else if (booking.status !== "READY_FOR_PICKUP") {
    throw new Error("This booking isn't ready for pickup.");
  }

  const { data: check, error: checkError } = await supabase
    .from("condition_checks")
    .upsert(
      {
        booking_id: booking.id,
        asset_id: booking.asset_id,
        type: "PRE_RENTAL",
        ack_powers_on: true,
        ack_no_damage: true,
        ack_accessories_present: true,
      },
      { onConflict: "booking_id,type" }
    )
    .select("id")
    .single();
  if (checkError || !check) throw new Error("Could not save your condition check. Please try again.");

  for (const field of PHOTO_FIELDS) {
    const photoType = PHOTO_TYPE_MAP[field];
    const path = conditionPhotoPath(booking.id, "pre-rental", photoType);
    await uploadConditionPhoto(path, photos[field]!);
    await supabase
      .from("condition_photos")
      .upsert(
        { condition_check_id: check.id, photo_type: photoType, storage_path: path },
        { onConflict: "condition_check_id,photo_type" }
      );
  }

  // The rental clock starts now, at actual pickup — not back when the
  // booking/payment was created a few minutes earlier.
  const { data: pkg } = await supabase
    .from("rental_packages")
    .select("duration_minutes")
    .eq("id", booking.rental_package_id)
    .single();

  const pickupTime = new Date();
  const newEndTime = pkg ? new Date(pickupTime.getTime() + pkg.duration_minutes * 60_000) : null;

  // By this point the booking is guaranteed READY_FOR_PICKUP — either it
  // already was, or the promotion above just put it there.
  assertValidBookingTransition("READY_FOR_PICKUP", "ACTIVE");

  const { error: bookingError } = await supabase
    .from("bookings")
    .update({
      status: "ACTIVE",
      actual_pickup_time: pickupTime.toISOString(),
      ...(newEndTime ? { end_time: newEndTime.toISOString() } : {}),
    })
    .eq("id", booking.id);
  if (bookingError) throw new Error(bookingError.message);

  await logAudit({
    actorType: "CUSTOMER",
    action: "PRE_RENTAL_CHECK_COMPLETED",
    entityType: "booking",
    entityId: booking.id,
    before: { status: "READY_FOR_PICKUP" },
    after: { status: "ACTIVE" },
  });

  const { error: assetError } = await supabase.rpc("system_transition_asset_status", {
    p_asset_id: booking.asset_id,
    p_to_status: "RENTED",
    p_actor_type: "CUSTOMER",
    p_booking_id: booking.id,
    p_event_type: "PRE_RENTAL_CHECK_COMPLETED",
  });
  if (assetError) throw new Error(assetError.message);
}

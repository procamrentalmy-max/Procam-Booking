"use server";

import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { uploadEvidencePhoto, conditionPhotoPath } from "@/lib/storage";
import { assertValidBookingTransition } from "@/lib/state-machine/booking";
import { getCheckTemplates, getBookingProductId } from "@/lib/booking/checkTemplates";
import { computeLateFeeMyr } from "@/lib/booking/lateFee";
import { logAudit } from "@/lib/audit";
import type { BookingStatus } from "@/lib/db/types";

/**
 * Completes the return condition check (spec section 14) using the
 * booking's product's RETURN check_templates, then immediately carries
 * the booking through RETURN_STARTED -> AWAITING_INSPECTION and the asset
 * RENTED -> RETURNED_AWAITING_INSPECTION.
 *
 * In the old reception model these were two separate, staff-mediated
 * steps: the customer's own condition check, then reception physically
 * confirming the pouch was handed back. There's no reception anymore, so
 * the customer's own submission is the only signal the system has that
 * the equipment has been physically placed back in the locker — there's
 * no way to verify that independently without hardware this project
 * deliberately doesn't have (spec section 1: no electronics, no API).
 * The deposit is unaffected either way: it stays held until staff
 * inspection regardless of what the customer declares here.
 *
 * Also fixes late_fee_myr on the booking from this exact moment's
 * timestamp — the fee reflects when the customer actually says they
 * returned it, not whenever staff later gets around to inspecting it.
 * It's only settled (captured out of the deposit hold) at inspection time.
 */
export async function submitReturnConditionCheckAction(formData: FormData) {
  const token = z.string().min(1).parse(formData.get("token"));
  const damageReported = formData.get("damageReported") === "true";
  const damageDescription = formData.get("damageDescription");

  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id,status,asset_id,rental_package_id,end_time,dropoff_partner_id")
    .eq("secure_token", token)
    .maybeSingle();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "ACTIVE") throw new Error("This booking isn't active.");

  const productId = await getBookingProductId(booking.rental_package_id);
  if (!productId) throw new Error("Could not determine the rental product for this booking.");
  const templates = await getCheckTemplates(productId, "RETURN");
  if (!templates.length) throw new Error("No return check is configured for this product yet.");

  const photoTemplates = templates.filter((t) => t.input_type === "PHOTO");
  const booleanTemplates = templates.filter((t) => t.input_type === "BOOLEAN");

  const acknowledgements: Record<string, boolean> = {};
  for (const item of booleanTemplates) {
    const checked = formData.get(`ack_${item.item_key}`) === "true";
    if (item.required && !checked) throw new Error(`Please confirm: ${item.label}`);
    acknowledgements[item.item_key] = checked;
  }

  const photos: Record<string, File> = {};
  for (const item of photoTemplates) {
    const file = formData.get(`photo_${item.item_key}`);
    if (item.required && (!(file instanceof File) || file.size === 0)) {
      throw new Error(`Please add a photo: ${item.label}`);
    }
    if (file instanceof File && file.size > 0) photos[item.item_key] = file;
  }

  const { data: check, error: checkError } = await supabase
    .from("condition_checks")
    .upsert(
      {
        booking_id: booking.id,
        asset_id: booking.asset_id,
        type: "RETURN",
        acknowledgements,
        damage_reported: damageReported,
        damage_description: damageReported && typeof damageDescription === "string" ? damageDescription : null,
      },
      { onConflict: "booking_id,type" }
    )
    .select("id")
    .single();
  if (checkError || !check) throw new Error("Could not save your condition check. Please try again.");

  for (const item of photoTemplates) {
    const file = photos[item.item_key];
    if (!file) continue;
    const path = conditionPhotoPath(booking.id, "return", item.item_key);
    await uploadEvidencePhoto(path, file);
    await supabase
      .from("condition_photos")
      .upsert(
        { condition_check_id: check.id, check_template_item_id: item.id, storage_path: path },
        { onConflict: "condition_check_id,check_template_item_id" }
      );
  }

  assertValidBookingTransition(booking.status as BookingStatus, "RETURN_STARTED");
  assertValidBookingTransition("RETURN_STARTED", "AWAITING_INSPECTION");

  const { data: pkg } = await supabase
    .from("rental_packages")
    .select("late_fee_per_hour_myr")
    .eq("id", booking.rental_package_id)
    .single();
  const actualReturnTime = new Date();
  const lateFeeMyr = pkg
    ? computeLateFeeMyr(new Date(booking.end_time), actualReturnTime, pkg.late_fee_per_hour_myr)
    : 0;

  const { error: bookingError } = await supabase
    .from("bookings")
    .update({ status: "AWAITING_INSPECTION", actual_return_time: actualReturnTime.toISOString(), late_fee_myr: lateFeeMyr })
    .eq("id", booking.id);
  if (bookingError) throw new Error(bookingError.message);

  await logAudit({
    actorType: "CUSTOMER",
    action: "RETURN_CHECK_COMPLETED",
    entityType: "booking",
    entityId: booking.id,
    before: { status: "ACTIVE" },
    after: { status: "AWAITING_INSPECTION", damageReported },
  });

  const { error: assetError } = await supabase.rpc("system_transition_asset_status", {
    p_asset_id: booking.asset_id,
    p_to_status: "RETURNED_AWAITING_INSPECTION",
    p_actor_type: "CUSTOMER",
    p_booking_id: booking.id,
    p_event_type: "CUSTOMER_RETURNED_TO_LOCKER",
  });
  if (assetError) throw new Error(assetError.message);

  // One-way rentals: the camera's current location moves to wherever the
  // customer actually returned it, not back to wherever it was picked up.
  // Everything downstream (staff inspection, worker routing/collection)
  // already keys off rental_assets.partner_id as "current location", so
  // this is the only place that fact needs updating.
  const { error: locationError } = await supabase
    .from("rental_assets")
    .update({ partner_id: booking.dropoff_partner_id })
    .eq("id", booking.asset_id);
  if (locationError) throw new Error(locationError.message);
}

"use server";

import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { uploadConditionPhoto, conditionPhotoPath } from "@/lib/storage";
import { assertValidBookingTransition } from "@/lib/state-machine/booking";
import { getCheckTemplates, getBookingProductId } from "@/lib/booking/checkTemplates";
import { logAudit } from "@/lib/audit";
import type { BookingStatus } from "@/lib/db/types";

/**
 * Completes the return condition check (spec section 14) using the
 * booking's product's RETURN check_templates. Moves the booking ACTIVE ->
 * RETURN_STARTED — asset status does NOT change here. It only becomes
 * RETURNED_AWAITING_INSPECTION once reception physically confirms receipt
 * (app/reception/return/actions.ts); the deposit stays held throughout,
 * regardless of what the customer declares here.
 */
export async function submitReturnConditionCheckAction(formData: FormData) {
  const token = z.string().min(1).parse(formData.get("token"));
  const damageReported = formData.get("damageReported") === "true";
  const damageDescription = formData.get("damageDescription");

  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id,status,asset_id,rental_package_id")
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
    await uploadConditionPhoto(path, file);
    await supabase
      .from("condition_photos")
      .upsert(
        { condition_check_id: check.id, check_template_item_id: item.id, storage_path: path },
        { onConflict: "condition_check_id,check_template_item_id" }
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

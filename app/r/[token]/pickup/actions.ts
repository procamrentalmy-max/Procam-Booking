"use server";

import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { uploadEvidencePhoto, conditionPhotoPath } from "@/lib/storage";
import { assertValidBookingTransition } from "@/lib/state-machine/booking";
import { promoteBookingToReadyForPickup } from "@/lib/booking/confirm";
import { getCheckTemplates, getBookingProductId } from "@/lib/booking/checkTemplates";
import { logAudit } from "@/lib/audit";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n/locale";

/**
 * Completes the pre-rental condition check (spec section 10) using the
 * booking's product's PRE_RENTAL check_templates — a SeaLife booking asks
 * for the sealing area and a seal-test acknowledgement, an Insta360 one
 * asks for lens photos, same code path either way. This is the one place
 * a booking moves READY_FOR_PICKUP -> ACTIVE and its asset moves
 * READY_FOR_PICKUP -> RENTED — customers can't skip straight here without
 * a valid booking at the right status, and can't submit without every
 * required template item filled in.
 */
export async function submitPreRentalConditionCheckAction(formData: FormData) {
  const token = z.string().min(1).parse(formData.get("token"));
  const rawLocale = formData.get("locale");
  const locale = typeof rawLocale === "string" && isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const fullDict = getDictionary(locale);
  const dict = fullDict.pickupServer;

  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id,status,asset_id,rental_package_id")
    .eq("secure_token", token)
    .maybeSingle();
  if (!booking) throw new Error(fullDict.common.bookingNotFound);
  // CONFIRMED is allowed too: a booking scheduled ahead only gets its
  // asset catch-up-promoted to READY_FOR_PICKUP by the housekeeping cron
  // as its start time approaches (see lib/booking/confirm.ts), which can
  // lag a guest showing up early — the customer shouldn't be blocked from
  // their own condition check just because that promotion hasn't run yet.
  if (booking.status === "CONFIRMED") {
    await promoteBookingToReadyForPickup(booking.id);
  } else if (booking.status !== "READY_FOR_PICKUP") {
    throw new Error(dict.notReady);
  }

  const productId = await getBookingProductId(booking.rental_package_id);
  if (!productId) throw new Error(dict.noProduct);
  const templates = await getCheckTemplates(productId, "PRE_RENTAL");
  if (!templates.length) throw new Error(dict.noCheckConfigured);

  const photoTemplates = templates.filter((t) => t.input_type === "PHOTO");
  const booleanTemplates = templates.filter((t) => t.input_type === "BOOLEAN");

  const acknowledgements: Record<string, boolean> = {};
  for (const item of booleanTemplates) {
    const checked = formData.get(`ack_${item.item_key}`) === "true";
    if (item.required && !checked) {
      throw new Error(`${dict.confirmPrefix}${item.label}`);
    }
    acknowledgements[item.item_key] = checked;
  }

  const photos: Record<string, File> = {};
  for (const item of photoTemplates) {
    const file = formData.get(`photo_${item.item_key}`);
    if (item.required && (!(file instanceof File) || file.size === 0)) {
      throw new Error(`${dict.photoPrefix}${item.label}`);
    }
    if (file instanceof File && file.size > 0) photos[item.item_key] = file;
  }

  const { data: check, error: checkError } = await supabase
    .from("condition_checks")
    .upsert(
      {
        booking_id: booking.id,
        asset_id: booking.asset_id,
        type: "PRE_RENTAL",
        acknowledgements,
      },
      { onConflict: "booking_id,type" }
    )
    .select("id")
    .single();
  if (checkError || !check) throw new Error(dict.saveFailed);

  for (const item of photoTemplates) {
    const file = photos[item.item_key];
    if (!file) continue;
    const path = conditionPhotoPath(booking.id, "pre-rental", item.item_key);
    await uploadEvidencePhoto(path, file);
    await supabase
      .from("condition_photos")
      .upsert(
        { condition_check_id: check.id, check_template_item_id: item.id, storage_path: path },
        { onConflict: "condition_check_id,check_template_item_id" }
      );
  }

  // The return deadline is whatever was booked (end_time), full stop —
  // picking up early or late doesn't move it. actual_pickup_time is
  // recorded purely for the record; late fees at return are computed
  // against the booking's original end_time (lib/booking/lateFee.ts), not
  // against actual_pickup_time + duration.
  const pickupTime = new Date();

  // By this point the booking is guaranteed READY_FOR_PICKUP — either it
  // already was, or the promotion above just put it there.
  assertValidBookingTransition("READY_FOR_PICKUP", "ACTIVE");

  const { error: bookingError } = await supabase
    .from("bookings")
    .update({
      status: "ACTIVE",
      actual_pickup_time: pickupTime.toISOString(),
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

"use server";

import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { getAuthContext, hasMerchantAccess } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { uploadChecklistPhoto, checklistPhotoPath } from "@/lib/droneRental/storage";
import { computeHandoverWindow } from "@/lib/droneRental/handover";
import { findChargedBatteries, validateHandoutBatteries, type ChargedBattery } from "@/lib/droneRental/batteries";
import { dronePhotoSteps } from "@/lib/droneRental/photoSteps";
import { modelProfile, storedController } from "@/lib/droneRental/pricingRules";
import { checklistForRental } from "@/lib/droneRental/checklist";

export type PickupResult = {
  /** When the customer has to bring everything back (the rental's end), as an ISO string. */
  returnBy: string;
  /** Minutes the rental was cut short of the paid length because another booking follows closely; 0 almost always. */
  shortenedByMinutes: number;
};

/**
 * Hands a confirmed booking over to the customer: merchant-taken condition
 * photos, a signed-off checklist, and the initial battery handout — no
 * customer self-check step exists in this vertical (see
 * app/r/[token]/pickup/actions.ts for that other flow), this IS the pickup.
 */
export async function submitPickupAction(formData: FormData): Promise<PickupResult> {
  const ctx = await getAuthContext();
  if (!hasMerchantAccess(ctx)) throw new Error("Not authorized");

  const bookingId = uuidSchema.parse(formData.get("bookingId"));
  const customerSignedName = z.string().min(1, "Customer name is required").parse(formData.get("customerSignedName"));
  const acknowledgements = JSON.parse(String(formData.get("acknowledgements") ?? "{}")) as Record<string, boolean>;

  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("dr_bookings").select("id,status,drone_id,source,start_time,end_time,batteries_count,drone_model,controller_kind").eq("id", bookingId).single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "CONFIRMED") throw new Error("This booking isn't ready for pickup.");

  // Every guided photo is required — checked before anything is saved, so a missing one stops the handover cleanly.
  // (A model with no photo pages, the GT50, has none to check.)
  const profile = modelProfile(booking.drone_model);
  const controller = storedController(booking.drone_model, booking.controller_kind);
  const photoSteps = profile.photosRequired ? dronePhotoSteps(profile.key, controller) : [];
  const stepPhotos = photoSteps.map((step) => ({ step, file: formData.get(`photo_${step.key}`) }));
  for (const { step, file } of stepPhotos) {
    if (!(file instanceof File) || file.size === 0) throw new Error(`Missing photo: ${step.label}`);
  }

  const { data: items } = await supabase.from("dr_checklist_items").select("item_key").eq("active", true).contains("applies_to", [profile.key]);
  for (const item of checklistForRental(items ?? [], controller)) {
    if (!acknowledgements[item.item_key]) throw new Error(`Please confirm: ${item.item_key}`);
  }

  // Which batteries go out: exactly the ones the merchant was shown (re-checked, since they may have changed while
  // the photos were being taken), or the next charged ones for a request that names none. Settled before anything
  // is saved so a problem stops the handover cleanly.
  const requestedBatteryIds = formData.getAll("batteryIds").map(String);
  let handout: ChargedBattery[];
  if (requestedBatteryIds.length > 0) {
    const checked = await validateHandoutBatteries(booking.drone_id, requestedBatteryIds, booking.batteries_count);
    if (!checked) throw new Error("The batteries to hand out have changed. Refresh this page to see which ones to give the customer.");
    handout = checked;
  } else {
    handout = await findChargedBatteries(booking.drone_id, booking.batteries_count);
    if (handout.length < booking.batteries_count) {
      throw new Error(`Not enough charged batteries at the shop for this drone (need ${booking.batteries_count}).`);
    }
  }

  const { data: record, error: recordError } = await supabase
    .from("dr_checklist_records")
    .upsert(
      {
        booking_id: bookingId,
        phase: "PICKUP",
        acknowledgements,
        customer_signed_name: customerSignedName,
        signed_at: new Date().toISOString(),
        performed_by_staff_id: ctx.staffId,
      },
      { onConflict: "booking_id,phase" }
    )
    .select("id")
    .single();
  if (recordError || !record) throw new Error("Could not save the checklist.");

  // All the photos go up together, then are recorded in one go. A retry after a failed attempt replaces the earlier
  // records (the files are overwritten), so one hiccup never leaves a handover half-saved with duplicated photos.
  if (stepPhotos.length > 0) {
    await Promise.all(stepPhotos.map(({ step, file }) => uploadChecklistPhoto(checklistPhotoPath(bookingId, "pickup", step.key), file as File)));
    await supabase.from("dr_checklist_photos").delete().eq("booking_id", bookingId).eq("phase", "PICKUP");
    const { error: photoRowsError } = await supabase.from("dr_checklist_photos").insert(
      stepPhotos.map(({ step }) => ({
        booking_id: bookingId,
        phase: "PICKUP" as const,
        storage_path: checklistPhotoPath(bookingId, "pickup", step.key),
        item_key: step.key,
        taken_by_staff_id: ctx.staffId,
      }))
    );
    if (photoRowsError) throw new Error("Could not save the photos. Please try the handover again.");
  }

  // Hand out the batteries the customer chose (1 or 2): this drone's own first, then any other charged
  // battery at the shop — logged as swaps with no released_battery_id (nothing to
  // return, this is the initial handout) and a RM0 fee.
  for (const battery of handout) {
    await supabase.from("dr_batteries").update({ status: "WITH_CUSTOMER", current_booking_id: bookingId }).eq("id", battery.id);
    await supabase.from("dr_battery_swaps").insert({
      booking_id: bookingId,
      released_battery_id: null,
      issued_battery_id: battery.id,
      fee_myr: 0,
      performed_by_staff_id: ctx.staffId,
    });
  }

  // A walk-in's rental officially starts now, at handover (see computeHandoverWindow); an online booking keeps its slot.
  const handoverAt = new Date();
  const originalEnd = new Date(booking.end_time);
  const { data: nextBooking } = await supabase
    .from("dr_bookings")
    .select("start_time")
    .eq("drone_id", booking.drone_id)
    .neq("id", bookingId)
    .not("status", "in", "(CANCELLED,EXPIRED,COMPLETED)")
    .gte("start_time", originalEnd.toISOString())
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();
  const window = computeHandoverWindow({
    source: booking.source,
    start: new Date(booking.start_time),
    end: originalEnd,
    handoverAt,
    nextStart: nextBooking ? new Date(nextBooking.start_time) : null,
  });

  const { error: updateError } = await supabase
    .from("dr_bookings")
    .update({
      status: "ACTIVE",
      actual_pickup_time: handoverAt.toISOString(),
      start_time: window.start.toISOString(),
      end_time: window.end.toISOString(),
    })
    .eq("id", bookingId);
  if (updateError) throw new Error("Couldn't record the handover: " + updateError.message);
  await supabase.from("dr_drones").update({ status: "RENTED" }).eq("id", booking.drone_id);

  return { returnBy: window.end.toISOString(), shortenedByMinutes: window.shortenedByMinutes };
}

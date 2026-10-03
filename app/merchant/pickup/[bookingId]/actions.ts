"use server";

import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { getAuthContext, hasMerchantAccess } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { uploadChecklistPhoto, checklistPhotoPath } from "@/lib/droneRental/storage";
import { computeHandoverWindow } from "@/lib/droneRental/handover";
import { findChargedBatteries } from "@/lib/droneRental/batteries";
import { dronePhotoSteps } from "@/lib/droneRental/photoSteps";

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

  const { data: booking } = await supabase.from("dr_bookings").select("id,status,drone_id,source,start_time,end_time,batteries_count").eq("id", bookingId).single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "CONFIRMED") throw new Error("This booking isn't ready for pickup.");

  // Every guided photo is required — checked before anything is saved, so a missing one stops the handover cleanly.
  const photoSteps = dronePhotoSteps(booking.batteries_count, "pickup");
  const stepPhotos = photoSteps.map((step) => ({ step, file: formData.get(`photo_${step.key}`) }));
  for (const { step, file } of stepPhotos) {
    if (!(file instanceof File) || file.size === 0) throw new Error(`Missing photo: ${step.label}`);
  }

  const { data: items } = await supabase.from("dr_checklist_items").select("item_key").eq("active", true);
  for (const item of items ?? []) {
    if (!acknowledgements[item.item_key]) throw new Error(`Please confirm: ${item.item_key}`);
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

  for (const { step, file } of stepPhotos) {
    const path = checklistPhotoPath(bookingId, "pickup", step.key);
    await uploadChecklistPhoto(path, file as File);
    await supabase
      .from("dr_checklist_photos")
      .insert({ booking_id: bookingId, phase: "PICKUP", storage_path: path, item_key: step.key, taken_by_staff_id: ctx.staffId });
  }

  // Hand out the batteries the customer chose (1 or 2): this drone's own first, then any other charged
  // battery at the shop — logged as swaps with no released_battery_id (nothing to
  // return, this is the initial handout) and a RM0 fee.
  const availableBatteries = await findChargedBatteries(booking.drone_id, booking.batteries_count);
  if (availableBatteries.length < booking.batteries_count) {
    throw new Error(`Not enough charged batteries at the shop for this drone (need ${booking.batteries_count}).`);
  }

  for (const battery of availableBatteries) {
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

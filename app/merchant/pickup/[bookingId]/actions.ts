"use server";

import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { getAuthContext, hasMerchantAccess } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { uploadChecklistPhoto, checklistPhotoPath } from "@/lib/droneRental/storage";
import { BATTERIES_INCLUDED } from "@/lib/droneRental/pricingRules";

/**
 * Hands a confirmed booking over to the customer: merchant-taken condition
 * photos, a signed-off checklist, and the initial battery handout — no
 * customer self-check step exists in this vertical (see
 * app/r/[token]/pickup/actions.ts for that other flow), this IS the pickup.
 */
export async function submitPickupAction(formData: FormData) {
  const ctx = await getAuthContext();
  if (!hasMerchantAccess(ctx)) throw new Error("Not authorized");

  const bookingId = uuidSchema.parse(formData.get("bookingId"));
  const customerSignedName = z.string().min(1, "Customer name is required").parse(formData.get("customerSignedName"));
  const acknowledgements = JSON.parse(String(formData.get("acknowledgements") ?? "{}")) as Record<string, boolean>;

  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("dr_bookings").select("id,status,drone_id").eq("id", bookingId).single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "CONFIRMED") throw new Error("This booking isn't ready for pickup.");

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

  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  for (let i = 0; i < photos.length; i++) {
    const path = checklistPhotoPath(bookingId, "pickup", i);
    await uploadChecklistPhoto(path, photos[i]);
    await supabase.from("dr_checklist_photos").insert({ booking_id: bookingId, phase: "PICKUP", storage_path: path, taken_by_staff_id: ctx.staffId });
  }

  // Hand out the first BATTERIES_INCLUDED (2) charged batteries for this
  // drone — logged as swaps with no released_battery_id (nothing to
  // return, this is the initial handout) and a RM0 fee.
  const { data: availableBatteries } = await supabase
    .from("dr_batteries")
    .select("id,human_id")
    .eq("drone_id", booking.drone_id)
    .eq("status", "AT_SHOP")
    .order("human_id")
    .limit(BATTERIES_INCLUDED);
  if (!availableBatteries || availableBatteries.length < BATTERIES_INCLUDED) {
    throw new Error(`Not enough charged batteries at the shop for this drone (need ${BATTERIES_INCLUDED}).`);
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

  await supabase
    .from("dr_bookings")
    .update({ status: "ACTIVE", actual_pickup_time: new Date().toISOString() })
    .eq("id", bookingId);
  await supabase.from("dr_drones").update({ status: "RENTED" }).eq("id", booking.drone_id);
}

"use server";

import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { getAuthContext, hasMerchantAccess } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { uploadChecklistPhoto, checklistPhotoPath } from "@/lib/droneRental/storage";
import { resolveDroneDeposit, chargeLateFee } from "@/lib/droneRental/payment";
import { computeDepositCapture, lateFeeMyr, DepositCaptureError } from "@/lib/droneRental/pricingRules";
import { isReturnLate } from "@/lib/droneRental/slots";

const outcomeSchema = z.enum(["NONE", "DAMAGED", "LOST"]);

const schema = z.object({
  bookingId: uuidSchema,
  droneOutcome: outcomeSchema,
  controllerOutcome: outcomeSchema,
  droneDamageMyr: z.coerce.number().optional(),
  controllerDamageMyr: z.coerce.number().optional(),
});

export type ReturnResult = {
  lateFeeMyr: number;
  /** False when a late fee was due but the saved card couldn't be charged — the merchant has to collect it. */
  lateFeeCharged: boolean;
  /** Total captured from the deposit hold (0 = the whole hold was released). */
  capturedMyr: number;
  /** False when there was no card hold on file — any amount owed has to be collected another way. */
  holdFound: boolean;
};

export async function submitReturnAction(formData: FormData): Promise<ReturnResult> {
  const ctx = await getAuthContext();
  if (!hasMerchantAccess(ctx)) throw new Error("Not authorized");

  const parsed = schema.parse({
    bookingId: formData.get("bookingId"),
    droneOutcome: formData.get("droneOutcome"),
    controllerOutcome: formData.get("controllerOutcome"),
    droneDamageMyr: formData.get("droneDamageMyr") || undefined,
    controllerDamageMyr: formData.get("controllerDamageMyr") || undefined,
  });
  const acknowledgements = JSON.parse(String(formData.get("acknowledgements") ?? "{}")) as Record<string, boolean>;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  // Validate the verdict before touching anything — a bad damage amount
  // should stop the return cleanly, not leave it half-saved.
  let capture;
  try {
    capture = computeDepositCapture(
      { outcome: parsed.droneOutcome, damageMyr: parsed.droneDamageMyr },
      { outcome: parsed.controllerOutcome, damageMyr: parsed.controllerDamageMyr }
    );
  } catch (err) {
    if (err instanceof DepositCaptureError) throw new Error(err.message);
    throw err;
  }

  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("dr_bookings").select("id,status,drone_id,end_time").eq("id", parsed.bookingId).single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "ACTIVE") throw new Error("This booking isn't currently active.");

  const { data: record, error: recordError } = await supabase
    .from("dr_checklist_records")
    .upsert(
      {
        booking_id: parsed.bookingId,
        phase: "RETURN",
        acknowledgements,
        performed_by_staff_id: ctx.staffId,
        notes,
      },
      { onConflict: "booking_id,phase" }
    )
    .select("id")
    .single();
  if (recordError || !record) throw new Error("Could not save the return checklist.");

  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  for (let i = 0; i < photos.length; i++) {
    const path = checklistPhotoPath(parsed.bookingId, "return", i);
    await uploadChecklistPhoto(path, photos[i]);
    await supabase.from("dr_checklist_photos").insert({ booking_id: parsed.bookingId, phase: "RETURN", storage_path: path, taken_by_staff_id: ctx.staffId });
  }

  const { holdFound } = await resolveDroneDeposit({
    bookingId: parsed.bookingId,
    capture,
    droneOutcome: parsed.droneOutcome,
    controllerOutcome: parsed.controllerOutcome,
    resolvedByStaffId: ctx.staffId,
  });

  // Every battery still checked out to this booking comes back to the shop.
  await supabase.from("dr_batteries").update({ status: "AT_SHOP", current_booking_id: null }).eq("current_booking_id", parsed.bookingId);

  const actualReturnTime = new Date();
  await supabase.from("dr_bookings").update({ status: "COMPLETED", actual_return_time: actualReturnTime.toISOString() }).eq("id", parsed.bookingId);

  // A lost DRONE means it isn't coming back — pull it out of the bookable
  // fleet rather than leaving it AVAILABLE for a slot no one can fulfil.
  // A lost controller alone doesn't (the drone still exists), but the
  // merchant will want to know it needs replacing — that's what the
  // captured amount and the notes are for. Anything else frees it up.
  await supabase.from("dr_drones").update({ status: parsed.droneOutcome === "LOST" ? "LOST" : "AVAILABLE" }).eq("id", booking.drone_id);

  // Charged after everything else succeeds — a declined card on the late
  // fee shouldn't block completing the return itself; it's surfaced to the
  // merchant to chase up separately instead.
  const scheduledEnd = new Date(booking.end_time);
  let lateFee = 0;
  let lateFeeCharged = false;
  if (isReturnLate(actualReturnTime, scheduledEnd)) {
    lateFee = lateFeeMyr((actualReturnTime.getTime() - scheduledEnd.getTime()) / 60_000);
    try {
      await chargeLateFee(parsed.bookingId, lateFee);
      lateFeeCharged = true;
    } catch (err) {
      console.error("[drone return] late fee charge failed", err);
    }
  }

  return { lateFeeMyr: lateFee, lateFeeCharged, capturedMyr: capture.totalMyr, holdFound };
}

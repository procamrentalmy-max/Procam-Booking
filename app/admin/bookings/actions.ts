"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertValidBookingTransition } from "@/lib/state-machine/booking";
import type { BookingStatus } from "@/lib/db/types";

/**
 * Bypasses Stripe entirely and confirms a booking directly — for local/dev
 * testing when there's no public HTTPS endpoint for Stripe to reach (the
 * webhook needs one; see app/api/webhooks/stripe/route.ts and the Stripe
 * CLI's `stripe listen --forward-to` for local forwarding instead of this).
 * Real bookings should always be confirmed by the webhook, not this.
 */
export async function forceConfirmBookingAction(formData: FormData) {
  const id = z.string().uuid().parse(formData.get("id"));
  const supabase = await createServerSupabaseClient();

  const { data: booking } = await supabase.from("bookings").select("status,camera_id").eq("id", id).single();
  if (!booking) throw new Error("Booking not found.");

  assertValidBookingTransition(booking.status as BookingStatus, "CONFIRMED");

  const { error } = await supabase.from("bookings").update({ status: "CONFIRMED" }).eq("id", id);
  if (error) throw new Error(error.message);

  const { error: cameraError } = await supabase.rpc("transition_camera_status", {
    p_camera_id: booking.camera_id,
    p_to_status: "READY_FOR_PICKUP",
    p_booking_id: id,
    p_event_type: "ADMIN_TEST_CONFIRM",
  });
  if (cameraError) throw new Error(cameraError.message);

  revalidatePath("/admin/bookings");
}

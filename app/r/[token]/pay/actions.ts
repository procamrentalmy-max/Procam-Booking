"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { confirmBookingAfterPayment } from "@/lib/booking/confirm";

/**
 * DEV ONLY — bypasses Stripe entirely and confirms a booking exactly as if
 * the rental fee + deposit hold had both succeeded (reuses the same
 * confirmBookingAfterPayment the real webhook calls — see
 * app/api/webhooks/stripe/route.ts). Delete this action and its button in
 * page.tsx before launch; real bookings must only ever be confirmed by the
 * webhook, never this.
 */
export async function devBypassPaymentAction(formData: FormData) {
  const token = z.string().min(1).parse(formData.get("token"));
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("bookings").select("id,status").eq("secure_token", token).single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "PENDING_PAYMENT") throw new Error("This booking has already been paid.");

  await confirmBookingAfterPayment(booking.id);

  redirect(`/r/${token}`);
}

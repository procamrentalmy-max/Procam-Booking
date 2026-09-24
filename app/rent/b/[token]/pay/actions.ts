"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * DEV ONLY — bypasses Stripe and marks a booking CONFIRMED exactly as if
 * the rental fee had succeeded, same escape hatch app/r/[token]/pay/actions.ts
 * already has for the locker network. Deliberately does NOT place the
 * deposit hold (placeDroneDepositHold needs a real succeeded PaymentIntent
 * to pull a payment method from, which this bypass never creates) — the
 * real flow always goes through confirmDroneBookingAfterPayment via the
 * webhook. Delete this action and its button before launch.
 */
export async function devBypassDronePaymentAction(formData: FormData) {
  const token = z.string().min(1).parse(formData.get("token"));
  const rawNext = formData.get("next");
  const next = typeof rawNext === "string" && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("dr_bookings").select("id,status").eq("secure_token", token).single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "PENDING_PAYMENT") throw new Error("This booking has already been paid.");

  await supabase.from("dr_bookings").update({ status: "CONFIRMED" }).eq("id", booking.id);

  redirect(next ?? `/rent/b/${token}`);
}

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
  // Hiding the button isn't enough: a server action can be POSTed directly, so refuse in production here too.
  if (process.env.NODE_ENV === "production") throw new Error("Not available in production.");
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

/**
 * DEV ONLY — stands in for a walk-in customer choosing cash and saving their card: marks the rental fee as to be paid in
 * cash (the booking stays PENDING_PAYMENT until the merchant has the cash). No card is saved and no deposit hold is
 * placed, since there is no Stripe here. Same production refusal as devBypassDronePaymentAction.
 */
export async function devBypassCashChoiceAction(formData: FormData) {
  if (process.env.NODE_ENV === "production") throw new Error("Not available in production.");
  const token = z.string().min(1).parse(formData.get("token"));
  const rawNext = formData.get("next");
  const next = typeof rawNext === "string" && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("dr_bookings").select("id,status,source").eq("secure_token", token).single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "PENDING_PAYMENT") throw new Error("This booking has already been paid.");
  if (booking.source !== "MERCHANT_INSTANT") throw new Error("Paying in cash is only for walk-in rentals.");

  await supabase.from("dr_bookings").update({ paid_by: "CASH" }).eq("id", booking.id);

  redirect(`/rent/b/${token}/pay${next ? `?next=${encodeURIComponent(next)}` : ""}`);
}

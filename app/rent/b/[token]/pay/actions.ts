"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { cancelLostBooking, claimBookingSlot, isSlotStillFree } from "@/lib/droneRental/claimSlot";

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

  // The same rule as a real payment: whoever pays first gets the drone. A booking that lost it is closed and shows its popup.
  const claim = await claimBookingSlot(booking.id);
  if (!claim.claimed) await cancelLostBooking(booking.id);

  redirect(claim.claimed ? (next ?? `/rent/b/${token}`) : `/rent/b/${token}/pay`);
}

/**
 * Called by the pay page just before a card payment is taken: is a drone (and controller) still free for this booking? If not,
 * the booking is closed and nothing is charged, so the customer can be told to pick another time instead of paying for
 * something they can't have. Only the person holding the booking's link can ask.
 */
export async function checkSlotStillFreeAction(token: string): Promise<{ free: boolean }> {
  const parsed = z.string().min(1).max(200).parse(token);
  const supabase = createServiceRoleClient();
  const { data: booking } = await supabase.from("dr_bookings").select("id,status").eq("secure_token", parsed).maybeSingle();
  if (!booking || booking.status !== "PENDING_PAYMENT") return { free: booking?.status !== "CANCELLED" };
  const free = await isSlotStillFree(booking.id);
  if (!free) await cancelLostBooking(booking.id);
  return { free };
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

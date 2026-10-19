"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { cancelLostBooking, claimBookingSlot, isSlotStillFree } from "@/lib/droneRental/claimSlot";
import { startDepositConfirmation } from "@/lib/droneRental/payment";
import { createQrPayment } from "@/lib/droneRental/qrPayments";
import { getAuthContext, isAdmin } from "@/lib/auth/session";

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
  await confirmWithoutPayment(formData);
}

/**
 * A signed-in ADMIN testing the live site: confirms a booking without taking any payment, exactly like the local shortcut.
 * Nobody who isn't signed in as an admin can run it, whatever they send. The booking has no payment and no deposit hold.
 */
export async function adminSkipPaymentAction(formData: FormData) {
  if (!isAdmin(await getAuthContext())) throw new Error("Not available.");
  await confirmWithoutPayment(formData);
}

async function confirmWithoutPayment(formData: FormData) {
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
 * The customer's deposit hold didn't go on automatically (their bank refused or wanted approval), so they confirm it here, on
 * their booking page. Returns what the card form needs. Only the person holding the booking's link can ask.
 */
export async function startDepositConfirmationAction(token: string): Promise<{ clientSecret: string }> {
  const parsed = z.string().min(1).max(200).parse(token);
  const { data: booking } = await createServiceRoleClient().from("dr_bookings").select("id").eq("secure_token", parsed).maybeSingle();
  if (!booking) throw new Error("Booking not found.");
  return startDepositConfirmation(booking.id);
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

  const { data: booking } = await supabase.from("dr_bookings").select("id,status,source,shop_id,rental_fee_myr").eq("secure_token", token).single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "PENDING_PAYMENT") throw new Error("This booking has already been paid.");
  if (booking.source !== "MERCHANT_INSTANT") throw new Error("Paying in cash is only for walk-in rentals.");

  const chosen = formData.get("method") === "QR" ? "QR" : "CASH";
  await supabase.from("dr_bookings").update({ paid_by: chosen }).eq("id", booking.id);
  if (chosen === "QR") await createQrPayment({ shopId: booking.shop_id, bookingId: booking.id, kind: "RENTAL_FEE", amountMyr: Number(booking.rental_fee_myr) });

  redirect(`/rent/b/${token}/pay${next ? `?next=${encodeURIComponent(next)}` : ""}`);
}

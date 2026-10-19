"use server";

import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getPayQrUrl } from "@/lib/branding";
import { createQrPayment } from "@/lib/droneRental/qrPayments";
import { modelProfile } from "@/lib/droneRental/pricingRules";

const requestSchema = z.object({ token: z.string().min(1).max(200), shopId: uuidSchema, count: z.union([z.literal(1), z.literal(2)]) });

/**
 * The customer chose to pay a battery swap by QR at this shop: the shop gets an incoming QR payment to check. Only the person holding the booking's link
 * can ask, only while the rental is out, only at a shop that is open for swaps, and only for as many batteries as they are holding. Returns errors, never throws.
 */
export async function requestSwapQrPaymentAction(input: { token: string; shopId: string; count: number }): Promise<{ ok: true } | { error: string }> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { error: "Something went wrong. Please try again." };
  const { token, shopId, count } = parsed.data;
  const supabase = createServiceRoleClient();
  const { data: booking } = await supabase.from("dr_bookings").select("id,status,drone_model").eq("secure_token", token).maybeSingle();
  if (!booking || booking.status !== "ACTIVE") return { error: "You can pay for a swap once you have collected the drone." };
  const { data: shop } = await supabase.from("dr_shops").select("id,active").eq("id", shopId).maybeSingle();
  if (!shop || !shop.active) return { error: "That shop is not available for swaps." };
  if (!(await getPayQrUrl())) return { error: "Paying by QR is not available right now." };
  const { count: held } = await supabase.from("dr_batteries").select("id", { count: "exact", head: true }).eq("current_booking_id", booking.id).eq("status", "WITH_CUSTOMER");
  if ((held ?? 0) < count) return { error: "You are not holding that many batteries." };
  // One open QR payment per rental: if there is one at another shop, it has to be finished or cancelled first.
  const { data: open } = await supabase.from("dr_qr_payments").select("shop_id").eq("booking_id", booking.id).eq("kind", "BATTERY_SWAP_FEE").in("status", ["PENDING", "CONFIRMED"]).maybeSingle();
  if (open && open.shop_id !== shopId) return { error: "You already have a QR payment open at another shop." };
  await createQrPayment({ shopId, bookingId: booking.id, kind: "BATTERY_SWAP_FEE", amountMyr: modelProfile(booking.drone_model).batteryFeeMyr[count], batteryCount: count });
  return { ok: true };
}

/** The customer decides to pay another way: their own QR payment, if the shop has not confirmed it yet, is closed. */
export async function cancelSwapQrPaymentAction(input: { token: string }): Promise<void> {
  const token = z.string().min(1).max(200).parse(input.token);
  const supabase = createServiceRoleClient();
  const { data: booking } = await supabase.from("dr_bookings").select("id").eq("secure_token", token).maybeSingle();
  if (!booking) return;
  await supabase
    .from("dr_qr_payments")
    .update({ status: "CANCELLED", resolved_at: new Date().toISOString() })
    .eq("booking_id", booking.id)
    .eq("kind", "BATTERY_SWAP_FEE")
    .eq("status", "PENDING");
}

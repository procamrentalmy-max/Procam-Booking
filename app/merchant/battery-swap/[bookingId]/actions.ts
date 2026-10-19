"use server";

import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { getAuthContext, hasMerchantAccess } from "@/lib/auth/session";
import { canAccessShop } from "@/lib/droneRental/access";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { chargeBatterySwapFee } from "@/lib/droneRental/payment";
import { useQrSwapPayment } from "@/lib/droneRental/qrPayments";
import { findChargedBatteries, validateHandoutBatteries, type ChargedBattery } from "@/lib/droneRental/batteries";
import { isBatteryCount, MAX_BATTERIES_HELD, modelProfile } from "@/lib/droneRental/pricingRules";

const schema = z.object({
  bookingId: uuidSchema,
  // The shop doing the swap: a customer can swap at any shop. Defaults to the shop of the booking.
  swapShopId: uuidSchema.optional(),
  returnedBatteryIds: z.array(uuidSchema).min(1, "Pick at least one battery").max(MAX_BATTERIES_HELD),
  // Each swap is paid for on its own: by the saved card or in cash, whatever the rental fee was.
  paidBy: z.enum(["CARD", "CASH", "QR"]).default("CARD"),
});

/**
 * Swaps one or two of the batteries the customer is holding for fully
 * charged ones: RM7 for one, RM10 for two (the same prices as choosing
 * 1 or 2 batteries at booking). The customer always hands back exactly as
 * many as they receive, so they never hold more than they started with.
 * Charges the fee off-session before touching any battery state, so a
 * declined card stops the swap before any battery physically changes hands.
 *
 * The swap can be done at any shop. The batteries handed out are that shop's (charged, and fitting the drone's model); the customer's used
 * ones stay there, so they are now away from home and show on the "Back home" list until staff carry them back. The swap fee is earned
 * by the shop that did the swap. The final return is still at the shop of the booking, where the customer brings the drone and whatever
 * batteries they hold.
 */
export async function submitBatterySwapAction(formData: FormData) {
  const ctx = await getAuthContext();
  if (!hasMerchantAccess(ctx)) throw new Error("Not authorized");

  const parsed = schema.safeParse({ bookingId: formData.get("bookingId"), returnedBatteryIds: formData.getAll("returnedBatteryIds"), swapShopId: formData.get("swapShopId") || undefined, paidBy: formData.get("paidBy") ?? undefined });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Pick the batteries being handed back.");
  const { bookingId } = parsed.data;
  const returnedIds = [...new Set(parsed.data.returnedBatteryIds)];
  const count = returnedIds.length;
  if (!isBatteryCount(count)) throw new Error("You can swap one or two batteries at a time.");

  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("dr_bookings").select("id,status,drone_id,drone_model,shop_id").eq("id", bookingId).single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "ACTIVE") throw new Error("This booking isn't currently active.");
  const swapShopId = parsed.data.swapShopId ?? booking.shop_id;
  if (!(await canAccessShop(ctx, swapShopId))) throw new Error("Not authorized");

  const { data: held } = await supabase.from("dr_batteries").select("id").eq("current_booking_id", bookingId).eq("status", "WITH_CUSTOMER");
  const heldIds = new Set((held ?? []).map((b) => b.id));
  if (!returnedIds.every((id) => heldIds.has(id))) throw new Error("One of those batteries isn't currently with this customer.");

  // Give exactly the batteries the merchant was shown (re-checked, they may have changed), or the next charged ones.
  const requestedReplacementIds = formData.getAll("replacementIds").map(String);
  let replacements: ChargedBattery[];
  if (requestedReplacementIds.length > 0) {
    const checked = await validateHandoutBatteries(booking.drone_id, requestedReplacementIds, count, swapShopId);
    if (!checked) throw new Error("The batteries to hand over have changed. Refresh this page to see which ones to give the customer.");
    replacements = checked;
  } else {
    replacements = await findChargedBatteries(booking.drone_id, count, swapShopId);
  }
  if (replacements.length < count) {
    throw new Error(
      replacements.length === 0
        ? "No charged battery is available at this shop right now."
        : `Only ${replacements.length} charged ${replacements.length === 1 ? "battery is" : "batteries are"} available right now. Swap ${replacements.length} instead.`
    );
  }

  // Paid by QR: only with a QR payment the merchant has already confirmed, for this booking, this shop and this many batteries.
  if (parsed.data.paidBy === "QR") await useQrSwapPayment({ bookingId, shopId: swapShopId, batteryCount: count });
  await chargeBatterySwapFee(bookingId, count, parsed.data.paidBy);

  for (let i = 0; i < count; i++) {
    await supabase.from("dr_batteries").update({ status: "AT_SHOP", current_booking_id: null, at_shop_id: swapShopId }).eq("id", returnedIds[i]);
    await supabase.from("dr_batteries").update({ status: "WITH_CUSTOMER", current_booking_id: bookingId }).eq("id", replacements[i].id);
    await supabase.from("dr_battery_swaps").insert({
      booking_id: bookingId,
      released_battery_id: returnedIds[i],
      issued_battery_id: replacements[i].id,
      // The whole swap is charged once; it's recorded against the first battery so the fee isn't counted twice.
      fee_myr: i === 0 ? modelProfile(booking.drone_model).batteryFeeMyr[count] : 0,
      paid_by: parsed.data.paidBy,
      swap_shop_id: swapShopId,
      performed_by_staff_id: ctx.staffId,
    });
  }
}

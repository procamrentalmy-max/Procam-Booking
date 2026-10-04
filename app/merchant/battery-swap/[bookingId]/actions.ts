"use server";

import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { getAuthContext, hasMerchantAccess } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { chargeBatterySwapFee } from "@/lib/droneRental/payment";
import { findChargedBatteries } from "@/lib/droneRental/batteries";
import { isBatteryCount, MAX_BATTERIES_HELD, modelProfile } from "@/lib/droneRental/pricingRules";

const schema = z.object({
  bookingId: uuidSchema,
  returnedBatteryIds: z.array(uuidSchema).min(1, "Pick at least one battery").max(MAX_BATTERIES_HELD),
});

/**
 * Swaps one or two of the batteries the customer is holding for fully
 * charged ones: RM7 for one, RM10 for two (the same prices as choosing
 * 1 or 2 batteries at booking). The customer always hands back exactly as
 * many as they receive, so they never hold more than they started with.
 * Charges the fee off-session before touching any battery state, so a
 * declined card stops the swap before any battery physically changes hands.
 */
export async function submitBatterySwapAction(formData: FormData) {
  const ctx = await getAuthContext();
  if (!hasMerchantAccess(ctx)) throw new Error("Not authorized");

  const parsed = schema.safeParse({ bookingId: formData.get("bookingId"), returnedBatteryIds: formData.getAll("returnedBatteryIds") });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Pick the batteries being handed back.");
  const { bookingId } = parsed.data;
  const returnedIds = [...new Set(parsed.data.returnedBatteryIds)];
  const count = returnedIds.length;
  if (!isBatteryCount(count)) throw new Error("You can swap one or two batteries at a time.");

  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("dr_bookings").select("id,status,drone_id,drone_model").eq("id", bookingId).single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "ACTIVE") throw new Error("This booking isn't currently active.");

  const { data: held } = await supabase.from("dr_batteries").select("id").eq("current_booking_id", bookingId).eq("status", "WITH_CUSTOMER");
  const heldIds = new Set((held ?? []).map((b) => b.id));
  if (!returnedIds.every((id) => heldIds.has(id))) throw new Error("One of those batteries isn't currently with this customer.");

  const replacements = await findChargedBatteries(booking.drone_id, count);
  if (replacements.length < count) {
    throw new Error(
      replacements.length === 0
        ? "No charged battery is available at the shop right now."
        : `Only ${replacements.length} charged ${replacements.length === 1 ? "battery is" : "batteries are"} available right now. Swap ${replacements.length} instead.`
    );
  }

  await chargeBatterySwapFee(bookingId, count);

  for (let i = 0; i < count; i++) {
    await supabase.from("dr_batteries").update({ status: "AT_SHOP", current_booking_id: null }).eq("id", returnedIds[i]);
    await supabase.from("dr_batteries").update({ status: "WITH_CUSTOMER", current_booking_id: bookingId }).eq("id", replacements[i].id);
    await supabase.from("dr_battery_swaps").insert({
      booking_id: bookingId,
      released_battery_id: returnedIds[i],
      issued_battery_id: replacements[i].id,
      // The whole swap is charged once; it's recorded against the first battery so the fee isn't counted twice.
      fee_myr: i === 0 ? modelProfile(booking.drone_model).batteryFeeMyr[count] : 0,
      performed_by_staff_id: ctx.staffId,
    });
  }
}

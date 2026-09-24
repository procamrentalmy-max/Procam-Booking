"use server";

import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { getAuthContext, hasMerchantAccess } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { chargeBatterySwapFee } from "@/lib/droneRental/payment";
import { MAX_BATTERIES_HELD, BATTERY_SWAP_FEE_MYR } from "@/lib/droneRental/pricingRules";

const schema = z.object({ bookingId: uuidSchema, returnedBatteryId: uuidSchema });

/**
 * A customer can hold at most MAX_BATTERIES_HELD (2) batteries — swapping
 * in a fresh one always means returning one of the two they're currently
 * holding first, so the merchant always picks exactly one to take back.
 * Charges the RM6 swap fee off-session before touching any battery state,
 * so a declined card stops the swap before any battery physically changes
 * hands.
 */
export async function submitBatterySwapAction(formData: FormData) {
  const ctx = await getAuthContext();
  if (!hasMerchantAccess(ctx)) throw new Error("Not authorized");

  const parsed = schema.parse({ bookingId: formData.get("bookingId"), returnedBatteryId: formData.get("returnedBatteryId") });
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("dr_bookings").select("id,status,drone_id").eq("id", parsed.bookingId).single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "ACTIVE") throw new Error("This booking isn't currently active.");

  const { data: held } = await supabase
    .from("dr_batteries")
    .select("id")
    .eq("current_booking_id", parsed.bookingId)
    .eq("status", "WITH_CUSTOMER");
  if (!held?.some((b) => b.id === parsed.returnedBatteryId)) throw new Error("That battery isn't currently with this customer.");
  if ((held?.length ?? 0) > MAX_BATTERIES_HELD) throw new Error("This booking is already holding more batteries than allowed — check inventory.");

  const { data: replacement } = await supabase
    .from("dr_batteries")
    .select("id")
    .eq("drone_id", booking.drone_id)
    .eq("status", "AT_SHOP")
    .order("human_id")
    .limit(1)
    .maybeSingle();
  if (!replacement) throw new Error("No charged battery available for this drone right now.");

  await chargeBatterySwapFee(parsed.bookingId);

  await supabase.from("dr_batteries").update({ status: "AT_SHOP", current_booking_id: null }).eq("id", parsed.returnedBatteryId);
  await supabase.from("dr_batteries").update({ status: "WITH_CUSTOMER", current_booking_id: parsed.bookingId }).eq("id", replacement.id);

  await supabase.from("dr_battery_swaps").insert({
    booking_id: parsed.bookingId,
    released_battery_id: parsed.returnedBatteryId,
    issued_battery_id: replacement.id,
    fee_myr: BATTERY_SWAP_FEE_MYR,
    performed_by_staff_id: ctx.staffId,
  });
}

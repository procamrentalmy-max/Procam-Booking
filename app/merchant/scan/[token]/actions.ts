"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getAuthContext, hasMerchantAccess } from "@/lib/auth/session";
import { canAccessShop } from "@/lib/droneRental/access";

/**
 * "Accept order" after scanning a customer's booking QR. Single-use: the update only matches a paid,
 * not-yet-accepted booking, so a second press (or a second merchant's scan) can't accept it again.
 * Returns the booking id so the screen can move straight on to the handover.
 */
export async function acceptCheckInAction(token: string): Promise<{ bookingId: string }> {
  const ctx = await getAuthContext();
  if (!hasMerchantAccess(ctx)) throw new Error("Not authorized");
  const secureToken = z.string().min(1).max(200).parse(token);

  const supabase = createServiceRoleClient();
  const { data: booking } = await supabase.from("dr_bookings").select("id,shop_id").eq("secure_token", secureToken).maybeSingle();
  if (!booking || !(await canAccessShop(ctx, booking.shop_id))) throw new Error("Not authorized");

  const { data: accepted } = await supabase
    .from("dr_bookings")
    .update({ checked_in_at: new Date().toISOString(), checked_in_by_staff_id: ctx!.staffId })
    .eq("id", booking.id)
    .eq("status", "CONFIRMED")
    .is("checked_in_at", null)
    .select("id")
    .maybeSingle();
  if (!accepted) throw new Error("This booking was already accepted, or isn't ready to accept.");

  revalidatePath(`/rent/b/${secureToken}`);
  revalidatePath("/merchant");
  return { bookingId: booking.id };
}

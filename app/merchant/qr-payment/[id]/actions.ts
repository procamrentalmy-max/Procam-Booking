"use server";

import { revalidatePath } from "next/cache";
import { uuidSchema } from "@/lib/zod-helpers";
import { getAuthContext, hasMerchantAccess } from "@/lib/auth/session";
import { canAccessShop } from "@/lib/droneRental/access";
import { cancelQrPayment, confirmQrPayment, getQrPayment } from "@/lib/droneRental/qrPayments";
import { createServiceRoleClient } from "@/lib/supabase/service";

async function authorize(id: string) {
  const ctx = await getAuthContext();
  if (!hasMerchantAccess(ctx)) throw new Error("Not authorized");
  const paymentId = uuidSchema.parse(id);
  const payment = await getQrPayment(paymentId);
  if (!payment || !(await canAccessShop(ctx, payment.shop_id))) throw new Error("Not authorized");
  return { ctx, payment };
}

function refresh(bookingId: string) {
  revalidatePath("/merchant");
  revalidatePath(`/merchant/battery-swap/${bookingId}`);
}

/**
 * The merchant has looked at the paid screen on the customer's phone and the money is there. Returns where to go next: a walk-in rental goes on to its
 * handover (it is now paid, like any other payment); a battery swap goes on to the swap screen, where the batteries are handed over and the fee is
 * already paid.
 */
export async function confirmQrPaymentAction(id: string): Promise<{ next: string }> {
  const { ctx, payment } = await authorize(id);
  await confirmQrPayment(payment.id, ctx.staffId);
  refresh(payment.booking_id);
  if (payment.kind === "BATTERY_SWAP_FEE") return { next: `/merchant/battery-swap/${payment.booking_id}?shop=${payment.shop_id}` };
  const { data: request } = await createServiceRoleClient().from("dr_walkin_requests").select("id").eq("booking_id", payment.booking_id).maybeSingle();
  return { next: request ? `/merchant/walk-in/${request.id}` : "/merchant" };
}

/** The payment did not arrive. A swap goes back to how it was; a walk-in rental is cancelled and its deposit hold released. */
export async function cancelQrPaymentAction(id: string): Promise<void> {
  const { ctx, payment } = await authorize(id);
  await cancelQrPayment(payment.id, ctx.staffId);
  refresh(payment.booking_id);
}

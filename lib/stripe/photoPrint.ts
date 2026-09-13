import "server-only";
import { getStripe, toCents } from "./client";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * A one-off charge for the order's total — unlike the camera rental flow,
 * there's no deposit hold or saved-card follow-up here, so this is a plain
 * automatic-capture PaymentIntent. Only GUEST-billed orders ever reach
 * this; HOTEL-billed orders skip payment entirely (see
 * app/p/[code]/print/actions.ts).
 */
export async function createPhotoPrintPaymentIntent(orderId: string): Promise<{ clientSecret: string }> {
  const supabase = createServiceRoleClient();
  const stripe = getStripe();

  const { data: order } = await supabase
    .from("photo_orders")
    .select("id,status,billed_to,total_price_myr,stripe_payment_intent_id")
    .eq("id", orderId)
    .single();
  if (!order) throw new Error("Photo order not found.");
  if (order.billed_to !== "GUEST") throw new Error("This order isn't billed to the guest.");
  if (order.status !== "PENDING_PAYMENT") throw new Error("This order has already been paid.");

  // Reuse an existing not-yet-resolved PaymentIntent rather than creating a
  // new one on every page load/refresh.
  if (order.stripe_payment_intent_id) {
    const intent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
    if (intent.status !== "canceled" && intent.client_secret) return { clientSecret: intent.client_secret };
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: toCents(order.total_price_myr),
    currency: "myr",
    metadata: { photoOrderId: orderId, kind: "PHOTO_PRINT" },
  });
  if (!paymentIntent.client_secret) throw new Error("Stripe did not return a client secret.");

  await supabase.from("photo_orders").update({ stripe_payment_intent_id: paymentIntent.id }).eq("id", orderId);

  return { clientSecret: paymentIntent.client_secret };
}

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createAndConfirmDepositIntent } from "@/lib/stripe/deposit";
import { confirmBookingAfterPayment } from "@/lib/booking/confirm";

/**
 * Orchestrates the two-charge flow (spec section 6):
 *   rental fee succeeds -> place the deposit hold on the same card
 *   -> deposit hold placed -> booking CONFIRMED, asset READY_FOR_PICKUP
 *
 * Known gap: if the deposit charge is declined right after a successful
 * rental-fee charge, this just logs it — the booking is left in
 * PENDING_PAYMENT with a paid rental fee and no path to recover
 * automatically. Handling that (retry a different card, refund, admin
 * alert) is a real product decision deferred past V1.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature ?? "", process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${(err as Error).message}` }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const { bookingId, kind } = intent.metadata as { bookingId?: string; kind?: string };
        if (!bookingId || kind !== "RENTAL_FEE") break;

        await supabase.from("payments").update({ status: "SUCCEEDED" }).eq("provider_ref", intent.id);

        const paymentMethodId =
          typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id;
        if (!paymentMethodId) break;

        await createAndConfirmDepositIntent(bookingId, paymentMethodId);
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        await supabase.from("payments").update({ status: "FAILED" }).eq("provider_ref", intent.id);
        break;
      }

      case "payment_intent.amount_capturable_updated": {
        // Manual-capture PaymentIntents reach here once authorized — this
        // is the deposit hold landing, not a card charge going through.
        const intent = event.data.object as Stripe.PaymentIntent;
        const { bookingId, kind } = intent.metadata as { bookingId?: string; kind?: string };
        if (!bookingId || kind !== "DEPOSIT") break;
        await confirmBookingAfterPayment(bookingId);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[stripe webhook] handler error", err);
    // Return 200 anyway — Stripe retries on non-2xx, and retrying a handler
    // that already partially applied its effects (idempotency guards above
    // aside) is more likely to cause duplicate side effects than to help.
  }

  return NextResponse.json({ received: true });
}

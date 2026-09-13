import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { confirmBookingAfterPayment } from "@/lib/booking/confirm";
import { assertValidDepositTransition } from "@/lib/state-machine/deposit";
import { logAudit } from "@/lib/audit";

/**
 * Orchestrates the payment side of the booking lifecycle:
 *   rental fee succeeds -> booking CONFIRMED (asset READY_FOR_PICKUP if
 *   imminent, otherwise the housekeeping cron promotes it later).
 *
 * The deposit hold itself is placed later, at physical pickup — see
 * createAndConfirmDepositIntent in lib/stripe/deposit.ts and its call site
 * in app/r/[token]/pickup/actions.ts — not here.
 *
 * This webhook also catches the deposit hold's other end: if staff never
 * capture or release it, Stripe auto-cancels the manual-capture
 * PaymentIntent after ~7 days and fires payment_intent.canceled, which the
 * case below turns into deposit_authorizations.status = EXPIRED.
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
        await confirmBookingAfterPayment(bookingId);
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        await supabase.from("payments").update({ status: "FAILED" }).eq("provider_ref", intent.id);
        break;
      }

      case "payment_intent.canceled": {
        // Fires both for a deliberate release (staff already flip
        // deposit_authorizations to RELEASED/CAPTURED/VOIDED synchronously
        // right before calling stripe.paymentIntents.cancel — see
        // passInspectionAction and resolveDamageCaseAction) and for
        // Stripe's own ~7-day auto-expiry of an untouched hold. The
        // AUTHORIZED guard below is what tells the two apart: a
        // deliberate release has already moved the row off AUTHORIZED by
        // the time this arrives, so only a genuine timeout matches here.
        const intent = event.data.object as Stripe.PaymentIntent;
        const { bookingId, kind } = intent.metadata as { bookingId?: string; kind?: string };
        if (kind !== "DEPOSIT") break;

        const { data: deposit } = await supabase
          .from("deposit_authorizations")
          .select("id,status")
          .eq("provider_ref", intent.id)
          .maybeSingle();
        if (!deposit || deposit.status !== "AUTHORIZED") break;

        assertValidDepositTransition("AUTHORIZED", "EXPIRED", "SYSTEM");
        await supabase
          .from("deposit_authorizations")
          .update({ status: "EXPIRED", resolved_at: new Date().toISOString() })
          .eq("id", deposit.id);

        if (bookingId) {
          await logAudit({
            actorType: "SYSTEM",
            action: "DEPOSIT_EXPIRED",
            entityType: "booking",
            entityId: bookingId,
            before: { status: "AUTHORIZED" },
            after: { status: "EXPIRED" },
          });
        }
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

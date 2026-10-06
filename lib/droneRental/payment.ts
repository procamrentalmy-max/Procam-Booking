import "server-only";
import { randomUUID } from "node:crypto";
import { getStripe, toCents } from "@/lib/stripe/client";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { DrPaidBy } from "@/lib/db/types";
import { modelProfile, type BatteryCount, type DepositCapture, type ItemOutcome } from "./pricingRules";

/** How a single payment is made: by card (Stripe) or in cash at the shop. Each payment on a booking is chosen on its own. */
export type PayMethod = DrPaidBy;

/**
 * Creates (or reuses) the rental-fee PaymentIntent for a drone booking.
 * Charges immediately (automatic capture) and, via setup_future_usage,
 * saves the card so the deposit hold can be placed on it right after —
 * unlike the locker network, there's no separate pickup step to defer that
 * to here: "book then pay and the system captures the deposit" happens in
 * one flow (see confirmDroneBookingAfterPayment).
 */
export async function createDroneRentalFeePaymentIntent(bookingId: string): Promise<{ clientSecret: string }> {
  const supabase = createServiceRoleClient();
  const stripe = getStripe();

  const { data: booking } = await supabase
    .from("dr_bookings")
    .select("id,status,customer_id,rental_fee_myr")
    .eq("id", bookingId)
    .single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "PENDING_PAYMENT") throw new Error("This booking has already been paid.");

  const [{ data: customer }, { data: existingPayment }] = await Promise.all([
    supabase.from("customers").select("id,name,email,stripe_customer_id").eq("id", booking.customer_id).single(),
    supabase.from("dr_payments").select("provider_ref,status").eq("booking_id", bookingId).eq("kind", "RENTAL_FEE").maybeSingle(),
  ]);
  if (!customer) throw new Error("Booking data is incomplete.");

  if (existingPayment && existingPayment.status === "PENDING") {
    const intent = await stripe.paymentIntents.retrieve(existingPayment.provider_ref);
    if (intent.client_secret) return { clientSecret: intent.client_secret };
  }

  let stripeCustomerId = customer.stripe_customer_id;
  if (!stripeCustomerId) {
    const stripeCustomer = await stripe.customers.create({ name: customer.name, email: customer.email });
    stripeCustomerId = stripeCustomer.id;
    await supabase.from("customers").update({ stripe_customer_id: stripeCustomerId }).eq("id", customer.id);
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: toCents(booking.rental_fee_myr),
    currency: "myr",
    customer: stripeCustomerId,
    setup_future_usage: "off_session",
    metadata: { droneBookingId: bookingId, kind: "DRONE_RENTAL_FEE" },
  });
  if (!paymentIntent.client_secret) throw new Error("Stripe did not return a client secret.");

  await supabase.from("dr_payments").insert({
    booking_id: bookingId,
    kind: "RENTAL_FEE",
    provider: "stripe",
    provider_ref: paymentIntent.id,
    amount_myr: booking.rental_fee_myr,
    status: "PENDING",
  });

  return { clientSecret: paymentIntent.client_secret };
}

/**
 * Places the deposit hold (DEPOSIT_MYR, drone + controller) — a second PaymentIntent, manual capture,
 * on the same card the rental fee just succeeded on. Called from the Stripe
 * webhook right after the rental-fee payment_intent.succeeds for this
 * vertical (see app/api/webhooks/stripe/route.ts), which is what "book then
 * pay and the system captures the deposit" actually means here: the hold
 * goes on immediately, not deferred to a pickup step the way the locker
 * network's is (that flow's deposit intentionally waits for physical pickup
 * — this one has no separate self-check pickup step to wait for).
 */
export async function placeDroneDepositHold(bookingId: string, knownPaymentMethodId?: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const stripe = getStripe();

  const { data: existing } = await supabase.from("dr_deposit_authorizations").select("id").eq("booking_id", bookingId).maybeSingle();
  if (existing) return; // already placed — webhook retried delivery

  const { data: booking } = await supabase.from("dr_bookings").select("customer_id,deposit_myr").eq("id", bookingId).single();
  if (!booking) throw new Error(`Booking ${bookingId} not found`);

  const { data: customer } = await supabase.from("customers").select("stripe_customer_id").eq("id", booking.customer_id).single();
  const paymentMethodId = knownPaymentMethodId ?? (await savedPaymentMethodId(bookingId));
  if (!customer?.stripe_customer_id || !paymentMethodId) throw new Error("Booking data is incomplete for the deposit hold.");

  const depositIntent = await stripe.paymentIntents.create({
    amount: toCents(booking.deposit_myr),
    currency: "myr",
    customer: customer.stripe_customer_id,
    payment_method: paymentMethodId,
    capture_method: "manual",
    off_session: true,
    confirm: true,
    metadata: { droneBookingId: bookingId, kind: "DRONE_DEPOSIT" },
  });

  await supabase.from("dr_deposit_authorizations").insert({
    booking_id: bookingId,
    provider: "stripe",
    provider_ref: depositIntent.id,
    amount_myr: booking.deposit_myr,
    status: "AUTHORIZED",
  });
}

/**
 * The card a booking's later charges go on: the one saved on the booking when the customer chose to pay the rental fee in
 * cash, otherwise the one the rental-fee card payment used. Null if there is none.
 */
async function savedPaymentMethodId(bookingId: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data: booking } = await supabase.from("dr_bookings").select("stripe_payment_method_id").eq("id", bookingId).single();
  if (booking?.stripe_payment_method_id) return booking.stripe_payment_method_id;

  const { data: rentalFeePayment } = await supabase
    .from("dr_payments")
    .select("provider_ref")
    .eq("booking_id", bookingId)
    .eq("kind", "RENTAL_FEE")
    .eq("provider", "stripe")
    .eq("status", "SUCCEEDED")
    .maybeSingle();
  if (!rentalFeePayment) return null;
  const intent = await getStripe().paymentIntents.retrieve(rentalFeePayment.provider_ref);
  return typeof intent.payment_method === "string" ? intent.payment_method : (intent.payment_method?.id ?? null);
}

/**
 * The customer chose to pay the rental fee in cash at the shop. They still enter their card, here as a SetupIntent (no
 * charge): it is what the deposit is held on and what a later swap or late fee can be charged to. Returns the client
 * secret for the card form; finishCashCardSetup runs when they come back from it.
 */
export async function startCashCardSetup(bookingId: string): Promise<{ clientSecret: string }> {
  const supabase = createServiceRoleClient();
  const stripe = getStripe();

  const { data: booking } = await supabase.from("dr_bookings").select("id,status,source,customer_id").eq("id", bookingId).single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "PENDING_PAYMENT") throw new Error("This booking has already been paid.");
  if (booking.source !== "MERCHANT_INSTANT") throw new Error("Paying in cash is only for walk-in rentals.");

  const { data: customer } = await supabase.from("customers").select("id,name,email,stripe_customer_id").eq("id", booking.customer_id).single();
  if (!customer) throw new Error("Booking data is incomplete.");
  let stripeCustomerId = customer.stripe_customer_id;
  if (!stripeCustomerId) {
    const created = await stripe.customers.create({ name: customer.name, email: customer.email });
    stripeCustomerId = created.id;
    await supabase.from("customers").update({ stripe_customer_id: stripeCustomerId }).eq("id", customer.id);
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: stripeCustomerId,
    usage: "off_session",
    payment_method_types: ["card"],
    metadata: { droneBookingId: bookingId, kind: "DRONE_CASH_CARD_SETUP" },
  });
  if (!setupIntent.client_secret) throw new Error("Stripe did not return a client secret.");
  return { clientSecret: setupIntent.client_secret };
}

/**
 * The customer's card was saved for a cash rental: keep it on the booking, put the deposit hold on it, and mark the
 * rental fee as to be paid in cash. The booking stays PENDING_PAYMENT until the merchant has the cash and confirms
 * (markDroneBookingPaidCash). Checked against Stripe itself, not the browser, and safe to run twice.
 */
export async function finishCashCardSetup(bookingId: string, setupIntentId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const setupIntent = await getStripe().setupIntents.retrieve(setupIntentId);
  if (setupIntent.status !== "succeeded") throw new Error("Your card wasn't saved.");
  if (setupIntent.metadata?.droneBookingId !== bookingId) throw new Error("That card setup is for a different booking.");
  const paymentMethodId = typeof setupIntent.payment_method === "string" ? setupIntent.payment_method : setupIntent.payment_method?.id;
  if (!paymentMethodId) throw new Error("No card was saved.");

  const { data: booking } = await supabase.from("dr_bookings").select("status,paid_by").eq("id", bookingId).single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "PENDING_PAYMENT") return;

  await supabase.from("dr_bookings").update({ stripe_payment_method_id: paymentMethodId }).eq("id", bookingId);
  await placeDroneDepositHold(bookingId, paymentMethodId);
  await supabase.from("dr_bookings").update({ paid_by: "CASH" }).eq("id", bookingId).eq("status", "PENDING_PAYMENT");
}

/**
 * The merchant has the rental fee in cash: the booking is confirmed and the handover can start. Only once the customer
 * has finished the card step (paid_by is CASH then), so there is always a card behind the deposit.
 *
 * If the customer had also opened the card payment, that is cancelled first so they can't pay twice; if it has in fact
 * gone through, this stops and says so.
 */
export async function markDroneBookingPaidCash(bookingId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("dr_bookings").select("id,status,paid_by,rental_fee_myr").eq("id", bookingId).single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "PENDING_PAYMENT") throw new Error("This order isn't waiting for payment any more.");
  if (booking.paid_by !== "CASH") throw new Error("The customer hasn't chosen cash and saved their card yet.");

  const { data: pending } = await supabase
    .from("dr_payments")
    .select("id,provider_ref")
    .eq("booking_id", bookingId)
    .eq("kind", "RENTAL_FEE")
    .eq("status", "PENDING")
    .maybeSingle();
  if (pending) {
    try {
      await getStripe().paymentIntents.cancel(pending.provider_ref);
    } catch (err) {
      // A payment that already went through can't be cancelled: the customer has paid by card, so no cash is taken.
      // (Without live Stripe keys, as in local development, there is nothing to cancel.)
      if (process.env.NODE_ENV === "production") throw new Error("Couldn't cancel the customer's card payment. If they have already paid by card, there's nothing to collect. Otherwise try again.");
      console.error("[drone cash] could not cancel the card payment (dev)", err);
    }
  }

  const { data: claimed } = await supabase
    .from("dr_bookings")
    .update({ status: "CONFIRMED" })
    .eq("id", bookingId)
    .eq("status", "PENDING_PAYMENT")
    .select("id");
  if (!claimed || claimed.length === 0) throw new Error("This order isn't waiting for payment any more.");

  const record = { provider: "cash", provider_ref: `cash-${bookingId}`, status: "SUCCEEDED" as const };
  if (pending) await supabase.from("dr_payments").update(record).eq("id", pending.id);
  else await supabase.from("dr_payments").insert({ booking_id: bookingId, kind: "RENTAL_FEE", amount_myr: booking.rental_fee_myr, ...record });
}

/** Rental fee succeeded -> booking CONFIRMED, then the deposit hold goes on immediately. Called from the webhook. */
export async function confirmDroneBookingAfterPayment(bookingId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  // A booking set to pay in cash already has its deposit held; a late card payment must not confirm it a second time.
  const { data: current } = await supabase.from("dr_bookings").select("paid_by").eq("id", bookingId).single();
  if (current?.paid_by === "CASH") return;
  await supabase.from("dr_bookings").update({ status: "CONFIRMED" }).eq("id", bookingId).eq("status", "PENDING_PAYMENT");
  await placeDroneDepositHold(bookingId);
}

/**
 * Charges an extra fee off-session on the customer's saved card — no card
 * re-entry needed. Fails loudly (surfaced to the caller) rather than
 * silently letting an unpaid charge through, since unlike the deposit hold
 * this is real money the shop is meant to collect every time. Shared by
 * chargeBatterySwapFee and chargeLateFee — same mechanics, different amount
 * and bookkeeping kind.
 */
async function chargeOffSessionFee(params: {
  bookingId: string;
  amountMyr: number;
  dbKind: "BATTERY_SWAP_FEE" | "LATE_FEE";
  stripeMetadataKind: "DRONE_BATTERY_SWAP_FEE" | "DRONE_LATE_FEE";
  method: PayMethod;
}): Promise<{ paymentId: string; providerRef: string }> {
  const supabase = createServiceRoleClient();
  const stripe = getStripe();

  const { data: booking } = await supabase.from("dr_bookings").select("customer_id").eq("id", params.bookingId).single();
  if (!booking) throw new Error("Booking not found.");

  // Paid in cash: nothing to charge, the merchant takes it. It's recorded so the sales and the earnings count it.
  if (params.method === "CASH") {
    const providerRef = `cash-${randomUUID()}`;
    const { data: cashPayment, error: cashError } = await supabase
      .from("dr_payments")
      .insert({ booking_id: params.bookingId, kind: params.dbKind, provider: "cash", provider_ref: providerRef, amount_myr: params.amountMyr, status: "SUCCEEDED" })
      .select("id")
      .single();
    if (cashError || !cashPayment) throw new Error("Could not record the cash payment.");
    return { paymentId: cashPayment.id, providerRef };
  }

  const { data: customer } = await supabase.from("customers").select("stripe_customer_id").eq("id", booking.customer_id).single();
  const paymentMethodId = customer?.stripe_customer_id ? await savedPaymentMethodId(params.bookingId) : null;
  if (!customer?.stripe_customer_id || !paymentMethodId) {
    // A booking confirmed with the local dev "skip payment" shortcut never had a card. That can only happen outside
    // production (the shortcut doesn't exist there), so let the swap or fee through while developing; in production
    // it stays a hard stop so a fee is never silently skipped.
    if (process.env.NODE_ENV !== "production") return { paymentId: "dev-no-card", providerRef: "dev-no-card" };
    throw new Error("No saved payment method on this booking.");
  }

  const feeIntent = await stripe.paymentIntents.create({
    amount: toCents(params.amountMyr),
    currency: "myr",
    customer: customer.stripe_customer_id,
    payment_method: paymentMethodId,
    off_session: true,
    confirm: true,
    metadata: { droneBookingId: params.bookingId, kind: params.stripeMetadataKind },
  });

  const { data: payment, error } = await supabase
    .from("dr_payments")
    .insert({
      booking_id: params.bookingId,
      kind: params.dbKind,
      provider: "stripe",
      provider_ref: feeIntent.id,
      amount_myr: params.amountMyr,
      status: feeIntent.status === "succeeded" ? "SUCCEEDED" : "PENDING",
    })
    .select("id")
    .single();
  if (error || !payment) throw new Error("Could not record the charge.");

  return { paymentId: payment.id, providerRef: feeIntent.id };
}

/** Merchant swaps one or two batteries mid-rental — charges that model's battery price (Neo 2: RM7 or RM10) off-session. */
export async function chargeBatterySwapFee(bookingId: string, count: BatteryCount, method: PayMethod = "CARD"): Promise<{ paymentId: string; providerRef: string }> {
  const { data: booking } = await createServiceRoleClient().from("dr_bookings").select("drone_model").eq("id", bookingId).single();
  const amountMyr = modelProfile(booking?.drone_model).batteryFeeMyr[count];
  return chargeOffSessionFee({ bookingId, amountMyr, dbKind: "BATTERY_SWAP_FEE", stripeMetadataKind: "DRONE_BATTERY_SWAP_FEE", method });
}

/** Charged at return when the drone comes back past RETURN_GRACE_MINUTES late — see lib/droneRental/slots.ts::isReturnLate and pricingRules.ts::lateFeeMyr. */
export async function chargeLateFee(bookingId: string, amountMyr: number, method: PayMethod = "CARD"): Promise<{ paymentId: string; providerRef: string }> {
  return chargeOffSessionFee({ bookingId, amountMyr, dbKind: "LATE_FEE", stripeMetadataKind: "DRONE_LATE_FEE", method });
}

/**
 * Settles the deposit hold at return, per the merchant's per-item verdict
 * (see computeDepositCapture): nothing to capture releases the whole hold;
 * otherwise exactly that total is captured and Stripe's partial-capture
 * releases the rest back to the customer.
 *
 * The verdict is always written to the booking, even when there's no hold
 * to act on (the deposit hold failed to place, or the booking never went
 * through card payment) — otherwise a missing hold would leave the
 * merchant unable to finish a return at all. `holdFound: false` tells the
 * caller that any amount owed has to be collected another way.
 */
export async function resolveDroneDeposit(params: {
  bookingId: string;
  capture: DepositCapture;
  droneOutcome: ItemOutcome;
  controllerOutcome: ItemOutcome;
  resolvedByStaffId: string;
}): Promise<{ holdFound: boolean }> {
  const supabase = createServiceRoleClient();
  const { capture } = params;

  const { data: deposit } = await supabase
    .from("dr_deposit_authorizations")
    .select("id,provider_ref,status,amount_myr")
    .eq("booking_id", params.bookingId)
    .maybeSingle();

  if (deposit && deposit.status === "AUTHORIZED") {
    const stripe = getStripe();
    if (capture.totalMyr > deposit.amount_myr) {
      throw new Error("The amount to capture is more than the deposit that was held.");
    }
    if (capture.totalMyr <= 0) {
      await stripe.paymentIntents.cancel(deposit.provider_ref);
      await supabase
        .from("dr_deposit_authorizations")
        .update({ status: "RELEASED", resolved_at: new Date().toISOString(), resolved_by: params.resolvedByStaffId })
        .eq("id", deposit.id);
    } else {
      await stripe.paymentIntents.capture(deposit.provider_ref, { amount_to_capture: toCents(capture.totalMyr) });
      await supabase
        .from("dr_deposit_authorizations")
        .update({
          status: capture.totalMyr >= deposit.amount_myr ? "CAPTURED" : "PARTIALLY_CAPTURED",
          resolved_at: new Date().toISOString(),
          resolved_by: params.resolvedByStaffId,
        })
        .eq("id", deposit.id);
    }
  }

  await supabase
    .from("dr_bookings")
    .update({
      deposit_outcome: capture.overallOutcome,
      deposit_deduction_myr: capture.totalMyr,
      drone_outcome: params.droneOutcome,
      controller_outcome: params.controllerOutcome,
      drone_charge_myr: capture.droneChargeMyr,
      controller_charge_myr: capture.controllerChargeMyr,
    })
    .eq("id", params.bookingId);

  return { holdFound: !!deposit };
}

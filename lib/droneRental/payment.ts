import "server-only";
import { getStripe, toCents } from "@/lib/stripe/client";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { modelProfile, type BatteryCount, type DepositCapture, type ItemOutcome } from "./pricingRules";

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
export async function placeDroneDepositHold(bookingId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const stripe = getStripe();

  const { data: existing } = await supabase.from("dr_deposit_authorizations").select("id").eq("booking_id", bookingId).maybeSingle();
  if (existing) return; // already placed — webhook retried delivery

  const { data: booking } = await supabase.from("dr_bookings").select("customer_id,deposit_myr").eq("id", bookingId).single();
  if (!booking) throw new Error(`Booking ${bookingId} not found`);

  const [{ data: customer }, { data: rentalFeePayment }] = await Promise.all([
    supabase.from("customers").select("stripe_customer_id").eq("id", booking.customer_id).single(),
    supabase.from("dr_payments").select("provider_ref").eq("booking_id", bookingId).eq("kind", "RENTAL_FEE").eq("status", "SUCCEEDED").single(),
  ]);
  if (!customer?.stripe_customer_id || !rentalFeePayment) throw new Error("Booking data is incomplete for the deposit hold.");

  const rentalFeeIntent = await stripe.paymentIntents.retrieve(rentalFeePayment.provider_ref);
  const paymentMethodId =
    typeof rentalFeeIntent.payment_method === "string" ? rentalFeeIntent.payment_method : rentalFeeIntent.payment_method?.id;
  if (!paymentMethodId) throw new Error("No saved payment method to place the deposit hold on.");

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

/** Rental fee succeeded -> booking CONFIRMED, then the deposit hold goes on immediately. Called from the webhook. */
export async function confirmDroneBookingAfterPayment(bookingId: string): Promise<void> {
  const supabase = createServiceRoleClient();
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
}): Promise<{ paymentId: string; providerRef: string }> {
  const supabase = createServiceRoleClient();
  const stripe = getStripe();

  const { data: booking } = await supabase.from("dr_bookings").select("customer_id").eq("id", params.bookingId).single();
  if (!booking) throw new Error("Booking not found.");

  const [{ data: customer }, { data: rentalFeePayment }] = await Promise.all([
    supabase.from("customers").select("stripe_customer_id").eq("id", booking.customer_id).single(),
    supabase.from("dr_payments").select("provider_ref").eq("booking_id", params.bookingId).eq("kind", "RENTAL_FEE").eq("status", "SUCCEEDED").single(),
  ]);
  if (!customer?.stripe_customer_id || !rentalFeePayment) {
    // A booking confirmed with the local dev "skip payment" shortcut never had a card. That can only happen outside
    // production (the shortcut doesn't exist there), so let the swap or fee through while developing; in production
    // it stays a hard stop so a fee is never silently skipped.
    if (process.env.NODE_ENV !== "production") return { paymentId: "dev-no-card", providerRef: "dev-no-card" };
    throw new Error("No saved payment method on this booking.");
  }

  const rentalFeeIntent = await stripe.paymentIntents.retrieve(rentalFeePayment.provider_ref);
  const paymentMethodId =
    typeof rentalFeeIntent.payment_method === "string" ? rentalFeeIntent.payment_method : rentalFeeIntent.payment_method?.id;
  if (!paymentMethodId) throw new Error("No saved payment method on this booking.");

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
export async function chargeBatterySwapFee(bookingId: string, count: BatteryCount): Promise<{ paymentId: string; providerRef: string }> {
  const { data: booking } = await createServiceRoleClient().from("dr_bookings").select("drone_model").eq("id", bookingId).single();
  const amountMyr = modelProfile(booking?.drone_model).batteryFeeMyr[count];
  return chargeOffSessionFee({ bookingId, amountMyr, dbKind: "BATTERY_SWAP_FEE", stripeMetadataKind: "DRONE_BATTERY_SWAP_FEE" });
}

/** Charged at return when the drone comes back past RETURN_GRACE_MINUTES late — see lib/droneRental/slots.ts::isReturnLate and pricingRules.ts::lateFeeMyr. */
export async function chargeLateFee(bookingId: string, amountMyr: number): Promise<{ paymentId: string; providerRef: string }> {
  return chargeOffSessionFee({ bookingId, amountMyr, dbKind: "LATE_FEE", stripeMetadataKind: "DRONE_LATE_FEE" });
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

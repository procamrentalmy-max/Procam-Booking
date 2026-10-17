import "server-only";
import { notifyBooking } from "@/lib/whatsapp/notify";
import { randomUUID } from "node:crypto";
import { getStripe, toCents } from "@/lib/stripe/client";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { DrPaidBy } from "@/lib/db/types";
import { claimBookingSlot, cancelLostBooking } from "./claimSlot";
import { modelProfile, type BatteryCount, type DepositCapture, type ItemOutcome } from "./pricingRules";

/** How a single payment is made: by card (Stripe) or in cash at the shop. Each payment on a booking is chosen on its own. */
export type PayMethod = DrPaidBy;

/**
 * Creates (or reuses) what the card form of a drone booking collects: the DEPOSIT HOLD, a manual-capture PaymentIntent that only reserves the
 * money on the card. The rental fee is not touched here. It is charged, off-session on the same card, only after this hold is in place
 * (finishCardBooking), so a card that cannot hold the deposit means no booking, no fee and nothing charged at all. `setup_future_usage` keeps the
 * card for that fee, and for later swap and late fees.
 */
export async function createDroneCheckout(bookingId: string): Promise<{ clientSecret: string }> {
  const supabase = createServiceRoleClient();
  const stripe = getStripe();

  const { data: booking } = await supabase.from("dr_bookings").select("id,status,customer_id,deposit_myr,deposit_checkout_intent").eq("id", bookingId).single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "PENDING_PAYMENT") throw new Error("This booking has already been paid.");

  const { data: customer } = await supabase.from("customers").select("id,name,email,stripe_customer_id").eq("id", booking.customer_id).single();
  if (!customer) throw new Error("Booking data is incomplete.");

  if (booking.deposit_checkout_intent) {
    const existing = await stripe.paymentIntents.retrieve(booking.deposit_checkout_intent);
    // Still waiting for a card: reuse it. One that was refused or abandoned (a new card is needed) is replaced below.
    if (existing.client_secret && (existing.status === "requires_payment_method" || existing.status === "requires_confirmation" || existing.status === "requires_action")) {
      return { clientSecret: existing.client_secret };
    }
  }

  let stripeCustomerId = customer.stripe_customer_id;
  if (!stripeCustomerId) {
    const stripeCustomer = await stripe.customers.create({ name: customer.name, email: customer.email });
    stripeCustomerId = stripeCustomer.id;
    await supabase.from("customers").update({ stripe_customer_id: stripeCustomerId }).eq("id", customer.id);
  }

  const intent = await stripe.paymentIntents.create({
    amount: toCents(booking.deposit_myr),
    currency: "myr",
    customer: stripeCustomerId,
    payment_method_types: ["card"],
    capture_method: "manual",
    setup_future_usage: "off_session",
    metadata: { droneBookingId: bookingId, kind: "DRONE_DEPOSIT" },
  });
  if (!intent.client_secret) throw new Error("Stripe did not return a client secret.");
  await supabase.from("dr_bookings").update({ deposit_checkout_intent: intent.id }).eq("id", bookingId);
  return { clientSecret: intent.client_secret };
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
 * The customer's card was saved for a rental paid in cash or by QR: keep it on the booking, put the deposit hold on it, and mark the
 * rental fee as to be paid that way. The booking stays PENDING_PAYMENT until the merchant has the cash and confirms
 * (markDroneBookingPaidCash). Checked against Stripe itself, not the browser, and safe to run twice.
 */
export async function finishCashCardSetup(bookingId: string, setupIntentId: string, method: "CASH" | "QR" = "CASH"): Promise<void> {
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
  await supabase.from("dr_bookings").update({ paid_by: method }).eq("id", bookingId).eq("status", "PENDING_PAYMENT");
}

/**
 * The merchant has the rental fee, in cash or by QR (the customer showed the paid screen): the booking is confirmed and the handover can start.
 * Only once the customer has finished the card step (paid_by is that method then), so there is always a card behind the deposit.
 *
 * If the customer had also opened the card payment, that is cancelled first so they can't pay twice; if it has in fact
 * gone through, this stops and says so.
 */
export async function markDroneBookingPaidOffline(bookingId: string, method: "CASH" | "QR"): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("dr_bookings").select("id,status,paid_by,rental_fee_myr").eq("id", bookingId).single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "PENDING_PAYMENT") throw new Error("This order isn't waiting for payment any more.");
  if (booking.paid_by !== method) throw new Error(method === "QR" ? "The customer hasn't chosen to pay by QR and saved their card yet." : "The customer hasn't chosen cash and saved their card yet.");

  // If the customer had also opened the card form, its deposit hold is let go so they can't pay twice (the cash rental has its own hold).
  const { data: checkout } = await supabase.from("dr_bookings").select("deposit_checkout_intent").eq("id", bookingId).single();
  if (checkout?.deposit_checkout_intent) {
    try {
      await getStripe().paymentIntents.cancel(checkout.deposit_checkout_intent);
    } catch (err) {
      // One that already ended (never confirmed, or released) is fine. (Without live Stripe keys, as in local development, there is nothing to cancel.)
      if ((err as { code?: string }).code !== "payment_intent_unexpected_state" && process.env.NODE_ENV === "production") {
        throw new Error("Couldn't cancel the customer's card payment. If they have already paid by card, there's nothing to collect. Otherwise try again.");
      }
    }
  }

  // The cash is in hand: claim the drone (the same rule as a card payment: whoever pays first gets it).
  const claim = await claimBookingSlot(bookingId);
  if (!claim.claimed) {
    await cancelLostBooking(bookingId);
    throw new Error(
      method === "QR"
        ? "That drone was taken by someone else while the customer was paying. Decline this order and tell the customer their QR payment will need to be refunded."
        : "That drone was taken by someone else while the customer was paying. Don't take the cash: decline this order.",
    );
  }

  await supabase.from("dr_payments").insert({ booking_id: bookingId, kind: "RENTAL_FEE", amount_myr: booking.rental_fee_myr, provider: method === "QR" ? "qr" : "cash", provider_ref: `${method === "QR" ? "qr" : "cash"}-${bookingId}`, status: "SUCCEEDED" });
}

/** What happened when the card form's deposit hold was taken to the end (see finishCardBooking). */
/** BUSY: another run is finishing this booking right now (look at the booking again in a moment). */
export type CardBookingResult = "CONFIRMED" | "WAITING" | "DECLINED" | "SLOT_TAKEN" | "BUSY";

/**
 * The customer's deposit hold is in place, so the booking can go through, in this order and not otherwise:
 *   1. the hold is checked against Stripe itself (this booking's deposit, the full amount, actually held) and recorded;
 *   2. the rental fee is charged on the same card (off-session, with a fixed idempotency key so a repeat never charges twice);
 *   3. the booking claims its drone and is CONFIRMED (which is when the merchant first sees it).
 * If the fee is refused after the hold, the hold is released and nothing stays charged: no booking. If someone else claimed the
 * last drone first, the fee is refunded in full and the hold released, as before.
 * Safe to run twice, and called from the customer's return to the site and from the webhook (the hold arriving), whichever is first.
 */
export async function finishCardBooking(bookingId: string, depositIntentId: string): Promise<CardBookingResult> {
  const supabase = createServiceRoleClient();
  // One run at a time: the customer's return and Stripe's message arrive together. A run that crashed leaves its mark for 2 minutes at most.
  const staleBefore = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: locked } = await supabase
    .from("dr_bookings")
    .update({ card_finish_started_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("status", "PENDING_PAYMENT")
    .or(`card_finish_started_at.is.null,card_finish_started_at.lt.${staleBefore}`)
    .select("id");
  if (!locked || locked.length === 0) {
    const { data: now } = await supabase.from("dr_bookings").select("status").eq("id", bookingId).single();
    return now && (now.status === "CONFIRMED" || now.status === "ACTIVE" || now.status === "COMPLETED") ? "CONFIRMED" : "BUSY";
  }
  try {
    const result = await finishCardBookingLocked(bookingId, depositIntentId);
    if (result !== "CONFIRMED" && result !== "SLOT_TAKEN") await supabase.from("dr_bookings").update({ card_finish_started_at: null }).eq("id", bookingId);
    return result;
  } catch (err) {
    await supabase.from("dr_bookings").update({ card_finish_started_at: null }).eq("id", bookingId);
    throw err;
  }
}

async function finishCardBookingLocked(bookingId: string, depositIntentId: string): Promise<CardBookingResult> {
  const supabase = createServiceRoleClient();
  const stripe = getStripe();

  const { data: booking } = await supabase
    .from("dr_bookings")
    .select("status,paid_by,customer_id,rental_fee_myr,deposit_myr,deposit_checkout_intent")
    .eq("id", bookingId)
    .single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status === "CONFIRMED" || booking.status === "ACTIVE" || booking.status === "COMPLETED") return "CONFIRMED";
  if (booking.status !== "PENDING_PAYMENT") return "SLOT_TAKEN";
  // A rental set to be paid in cash has its own card step; a card payment opened alongside it must not confirm it a second time.
  if (booking.paid_by === "CASH") return "WAITING";

  const intent = await stripe.paymentIntents.retrieve(depositIntentId);
  if (intent.metadata?.kind !== "DRONE_DEPOSIT" || intent.metadata?.droneBookingId !== bookingId) return "WAITING";
  if (intent.status !== "requires_capture") return intent.status === "canceled" ? "DECLINED" : "WAITING";
  if (intent.amount !== toCents(booking.deposit_myr)) return "WAITING";
  const paymentMethodId = typeof intent.payment_method === "string" ? intent.payment_method : (intent.payment_method?.id ?? null);
  const customerId = typeof intent.customer === "string" ? intent.customer : (intent.customer?.id ?? null);
  if (!paymentMethodId || !customerId) return "WAITING";

  // 1. the hold is real: record it, and keep the card on the booking for the fee now and for swaps and late fees later.
  if (!(await finishDepositConfirmation(bookingId, depositIntentId))) return "WAITING";
  await supabase.from("dr_bookings").update({ stripe_payment_method_id: paymentMethodId }).eq("id", bookingId);

  // 2. the rental fee, on the same card.
  const { data: existingFee } = await supabase.from("dr_payments").select("id,status").eq("booking_id", bookingId).eq("kind", "RENTAL_FEE").eq("provider", "stripe").maybeSingle();
  if (!existingFee || existingFee.status !== "SUCCEEDED") {
    try {
      const fee = await stripe.paymentIntents.create(
        {
          amount: toCents(booking.rental_fee_myr),
          currency: "myr",
          customer: customerId,
          payment_method: paymentMethodId,
          off_session: true,
          confirm: true,
          metadata: { droneBookingId: bookingId, kind: "DRONE_RENTAL_FEE" },
        },
        { idempotencyKey: `drone-rental-fee-${bookingId}-${depositIntentId}` },
      );
      if (fee.status !== "succeeded") throw Object.assign(new Error(`The rental fee did not go through (${fee.status}).`), { type: "StripeCardError" });
      if (existingFee) await supabase.from("dr_payments").update({ provider_ref: fee.id, status: "SUCCEEDED" }).eq("id", existingFee.id);
      else await supabase.from("dr_payments").insert({ booking_id: bookingId, kind: "RENTAL_FEE", provider: "stripe", provider_ref: fee.id, amount_myr: booking.rental_fee_myr, status: "SUCCEEDED" });
    } catch (err) {
      if (!isCardError(err)) throw err; // our fault or the network's: the webhook tries again
      console.error("[drone booking] the card could not pay the rental fee after the deposit was held; the hold is released", bookingId, (err as Error).message);
      await releaseDepositHold(bookingId);
      return "DECLINED";
    }
  }

  // 3. the drone.
  const claim = await claimBookingSlot(bookingId);
  if (!claim.claimed) {
    // Never refund a booking that has in fact gone through (a repeat run, or the drone was claimed a moment ago).
    const { data: after } = await supabase.from("dr_bookings").select("status").eq("id", bookingId).single();
    if (after && (after.status === "CONFIRMED" || after.status === "ACTIVE")) return "CONFIRMED";
    await cancelLostBooking(bookingId);
    await refundDroneRentalFee(bookingId);
    await releaseDepositHold(bookingId);
    // Tell the customer: it was cancelled and refunded.
    await notifyBooking(bookingId, "BOOKING_CANCELLED");
    return "SLOT_TAKEN";
  }
  return "CONFIRMED";
}

/** Lets go of the booking's deposit hold (the money was only reserved, never charged) and records that it is released. Safe to run twice. */
async function releaseDepositHold(bookingId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: hold } = await supabase.from("dr_deposit_authorizations").select("id,provider_ref,status").eq("booking_id", bookingId).maybeSingle();
  if (!hold || hold.status !== "AUTHORIZED") return;
  try {
    await getStripe().paymentIntents.cancel(hold.provider_ref);
  } catch (err) {
    // Already gone (released or expired): the record below is still right.
    if ((err as { code?: string }).code !== "payment_intent_unexpected_state") throw err;
  }
  await supabase.from("dr_deposit_authorizations").update({ status: "RELEASED", resolved_at: new Date().toISOString() }).eq("id", hold.id);
}

/** A card refusal from Stripe (declined, or authentication needed), as opposed to a fault on our side or in the network. */
function isCardError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { type?: string }).type === "StripeCardError";
}

/**
 * A paid card booking that has no deposit hold on it yet: the automatic hold didn't go through, so the customer has to confirm
 * the deposit themselves. Not the case for a booking that never had a Stripe card payment (the local dev shortcut, a cash rental
 * whose card step is still to come).
 */
export async function needsDepositConfirmation(bookingId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const [{ data: booking }, { data: hold }, { data: fee }] = await Promise.all([
    supabase.from("dr_bookings").select("status").eq("id", bookingId).single(),
    supabase.from("dr_deposit_authorizations").select("status").eq("booking_id", bookingId).maybeSingle(),
    supabase.from("dr_payments").select("id").eq("booking_id", bookingId).eq("kind", "RENTAL_FEE").eq("provider", "stripe").eq("status", "SUCCEEDED").maybeSingle(),
  ]);
  return booking?.status === "CONFIRMED" && hold?.status !== "AUTHORIZED" && !!fee;
}

/**
 * The customer is on their booking page and asks to confirm the deposit: a new manual-capture PaymentIntent for the deposit, to be
 * confirmed in the browser (so a bank that wants 3D Secure can ask for it, and the customer can use another card if this one
 * has no room). Nothing is charged; finishDepositConfirmation records the hold once Stripe has it.
 */
export async function startDepositConfirmation(bookingId: string): Promise<{ clientSecret: string }> {
  if (!(await needsDepositConfirmation(bookingId))) throw new Error("This booking doesn't need a deposit confirmation.");
  const supabase = createServiceRoleClient();
  const stripe = getStripe();

  const { data: booking } = await supabase.from("dr_bookings").select("customer_id,deposit_myr").eq("id", bookingId).single();
  if (!booking) throw new Error("Booking not found.");
  const { data: customer } = await supabase.from("customers").select("id,name,email,stripe_customer_id").eq("id", booking.customer_id).single();
  if (!customer) throw new Error("Booking data is incomplete.");
  let stripeCustomerId = customer.stripe_customer_id;
  if (!stripeCustomerId) {
    const created = await stripe.customers.create({ name: customer.name, email: customer.email });
    stripeCustomerId = created.id;
    await supabase.from("customers").update({ stripe_customer_id: stripeCustomerId }).eq("id", customer.id);
  }

  const intent = await stripe.paymentIntents.create({
    amount: toCents(booking.deposit_myr),
    currency: "myr",
    customer: stripeCustomerId,
    payment_method_types: ["card"],
    capture_method: "manual",
    metadata: { droneBookingId: bookingId, kind: "DRONE_DEPOSIT" },
  });
  if (!intent.client_secret) throw new Error("Stripe did not return a client secret.");
  return { clientSecret: intent.client_secret };
}

/**
 * Records the deposit hold once Stripe has it (the customer confirmed it on their booking page). Checked against Stripe itself,
 * not the browser: it must be this booking's deposit, for the full amount, and actually held. Safe to run twice, and called
 * both when the customer comes back to the page and from the webhook.
 */
export async function finishDepositConfirmation(bookingId: string, paymentIntentId: string): Promise<boolean> {
  const intent = await getStripe().paymentIntents.retrieve(paymentIntentId);
  if (intent.metadata?.kind !== "DRONE_DEPOSIT" || intent.metadata?.droneBookingId !== bookingId) return false;
  if (intent.status !== "requires_capture") return false;

  const supabase = createServiceRoleClient();
  const { data: booking } = await supabase.from("dr_bookings").select("deposit_myr").eq("id", bookingId).single();
  if (!booking || intent.amount !== toCents(booking.deposit_myr)) return false;

  const { data: existing } = await supabase.from("dr_deposit_authorizations").select("id,status,provider_ref").eq("booking_id", bookingId).maybeSingle();
  if (existing?.status === "AUTHORIZED") return true;
  if (existing) {
    // An earlier hold that ended (it expired, say): this one takes its place.
    await supabase
      .from("dr_deposit_authorizations")
      .update({ provider_ref: intent.id, amount_myr: booking.deposit_myr, status: "AUTHORIZED", resolved_at: null, resolved_by: null })
      .eq("id", existing.id);
    return true;
  }
  const { error } = await supabase.from("dr_deposit_authorizations").insert({
    booking_id: bookingId,
    provider: "stripe",
    provider_ref: intent.id,
    amount_myr: booking.deposit_myr,
    status: "AUTHORIZED",
  });
  // 23505: the webhook and the page recorded it at the same moment; either way it is there now.
  if (error && error.code !== "23505") throw new Error(error.message);
  return true;
}

/** Gives the rental fee back (in full) for a booking that lost its slot after paying. Safe to run again: it does nothing once refunded. */
async function refundDroneRentalFee(bookingId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: payment } = await supabase
    .from("dr_payments")
    .select("id,provider_ref,status")
    .eq("booking_id", bookingId)
    .eq("kind", "RENTAL_FEE")
    .eq("provider", "stripe")
    .maybeSingle();
  if (!payment || payment.status === "REFUNDED") return;
  // Thrown on failure so the webhook is retried and the refund isn't lost.
  await getStripe().refunds.create({ payment_intent: payment.provider_ref }, { idempotencyKey: `drone-rental-refund-${bookingId}` });
  await supabase.from("dr_payments").update({ status: "REFUNDED" }).eq("id", payment.id);
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

  // Whether there was a live hold to settle. A hold Stripe had already ended (it ran out after about 7 days) counts as no hold.
  let holdFound = !!deposit && deposit.status !== "EXPIRED" && deposit.status !== "VOIDED";

  if (deposit && deposit.status === "AUTHORIZED") {
    const stripe = getStripe();
    if (capture.totalMyr > deposit.amount_myr) {
      throw new Error("The amount to capture is more than the deposit that was held.");
    }
    const resolvedAt = new Date().toISOString();
    try {
      if (capture.totalMyr <= 0) {
        await stripe.paymentIntents.cancel(deposit.provider_ref);
        await supabase
          .from("dr_deposit_authorizations")
          .update({ status: "RELEASED", resolved_at: resolvedAt, resolved_by: params.resolvedByStaffId })
          .eq("id", deposit.id);
      } else {
        await stripe.paymentIntents.capture(deposit.provider_ref, { amount_to_capture: toCents(capture.totalMyr) });
        await supabase
          .from("dr_deposit_authorizations")
          .update({
            status: capture.totalMyr >= deposit.amount_myr ? "CAPTURED" : "PARTIALLY_CAPTURED",
            resolved_at: resolvedAt,
            resolved_by: params.resolvedByStaffId,
          })
          .eq("id", deposit.id);
      }
    } catch (err) {
      // Stripe won't act on a hold that is no longer open. Look at what it is now instead of failing the return.
      if ((err as { code?: string }).code !== "payment_intent_unexpected_state") throw err;
      const intent = await stripe.paymentIntents.retrieve(deposit.provider_ref);
      if (intent.status === "canceled") {
        // Already gone (it ran out, or was released by hand): nothing can be captured from it any more.
        await supabase.from("dr_deposit_authorizations").update({ status: "EXPIRED", resolved_at: resolvedAt }).eq("id", deposit.id);
        holdFound = false;
      } else if (intent.status === "succeeded") {
        // Already captured earlier (the record just didn't get updated): record it as it is.
        const kept = (intent.amount_received ?? 0) / 100;
        await supabase
          .from("dr_deposit_authorizations")
          .update({ status: kept >= deposit.amount_myr ? "CAPTURED" : "PARTIALLY_CAPTURED", resolved_at: resolvedAt, resolved_by: params.resolvedByStaffId })
          .eq("id", deposit.id);
      } else {
        throw err;
      }
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

  return { holdFound };
}

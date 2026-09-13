import "server-only";
import { getStripe, toCents } from "./client";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * Places the security deposit hold: a second PaymentIntent, on the same
 * card the rental fee already succeeded on, with capture_method "manual"
 * — this is the authorize-only hold from spec section 6. It only ever gets
 * released (cancelled) or captured later, from the inspection/damage-review
 * flow — never here.
 *
 * Called from the pickup flow (app/r/[token]/pickup/actions.ts), not at
 * booking-confirmation time — Stripe auto-cancels an uncaptured manual-
 * capture hold after ~7 days for most card networks, so placing it here
 * makes that window cover the actual rental (and the return/inspection
 * that follows) instead of also having to cover however long the booking
 * sat CONFIRMED before the guest showed up.
 */
export async function createAndConfirmDepositIntent(bookingId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const stripe = getStripe();

  const { data: existing } = await supabase
    .from("deposit_authorizations")
    .select("id")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (existing) return; // retried pickup submission — already placed

  const { data: booking } = await supabase
    .from("bookings")
    .select("customer_id,rental_package_id")
    .eq("id", bookingId)
    .single();
  if (!booking) throw new Error(`Booking ${bookingId} not found`);

  const [{ data: customer }, { data: pkg }, { data: rentalFeePayment }] = await Promise.all([
    supabase.from("customers").select("stripe_customer_id").eq("id", booking.customer_id).single(),
    supabase.from("rental_packages").select("deposit_myr").eq("id", booking.rental_package_id).single(),
    supabase
      .from("payments")
      .select("provider_ref")
      .eq("booking_id", bookingId)
      .eq("kind", "RENTAL_FEE")
      .eq("status", "SUCCEEDED")
      .single(),
  ]);
  if (!customer?.stripe_customer_id || !pkg || !rentalFeePayment) {
    throw new Error("Booking data is incomplete for the deposit hold.");
  }

  // The rental fee's PaymentIntent is where the card actually lives —
  // setup_future_usage on that charge (lib/stripe/rental.ts) is what makes
  // it reusable off-session here, however long after booking pickup happens.
  const rentalFeeIntent = await stripe.paymentIntents.retrieve(rentalFeePayment.provider_ref);
  const paymentMethodId =
    typeof rentalFeeIntent.payment_method === "string" ? rentalFeeIntent.payment_method : rentalFeeIntent.payment_method?.id;
  if (!paymentMethodId) throw new Error("No saved payment method to place the deposit hold on.");

  const depositIntent = await stripe.paymentIntents.create({
    amount: toCents(pkg.deposit_myr),
    currency: "myr",
    customer: customer.stripe_customer_id,
    payment_method: paymentMethodId,
    capture_method: "manual",
    off_session: true,
    confirm: true,
    metadata: { bookingId, kind: "DEPOSIT" },
  });

  await supabase.from("deposit_authorizations").insert({
    booking_id: bookingId,
    provider: "stripe",
    provider_ref: depositIntent.id,
    amount_myr: pkg.deposit_myr,
    status: "AUTHORIZED",
  });
}

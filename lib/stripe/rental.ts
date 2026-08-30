import "server-only";
import { getStripe, toCents } from "./client";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * Creates (or reuses) the rental-fee PaymentIntent for a booking. This
 * charges immediately on confirmation (default capture_method: automatic)
 * and — via setup_future_usage — saves the card so the deposit hold can be
 * placed on the same card afterward without the customer re-entering it.
 */
export async function createRentalFeePaymentIntent(bookingId: string): Promise<{ clientSecret: string }> {
  const supabase = createServiceRoleClient();
  const stripe = getStripe();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id,status,customer_id,rental_package_id")
    .eq("id", bookingId)
    .single();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "PENDING_PAYMENT") throw new Error("This booking has already been paid.");

  const [{ data: customer }, { data: pkg }, { data: existingPayment }] = await Promise.all([
    supabase.from("customers").select("id,name,email,stripe_customer_id").eq("id", booking.customer_id).single(),
    supabase.from("rental_packages").select("price_myr").eq("id", booking.rental_package_id).single(),
    supabase
      .from("payments")
      .select("provider_ref,status")
      .eq("booking_id", bookingId)
      .eq("kind", "RENTAL_FEE")
      .maybeSingle(),
  ]);
  if (!customer || !pkg) throw new Error("Booking data is incomplete.");

  // Reuse an existing not-yet-resolved PaymentIntent rather than creating a
  // new one on every page load/refresh.
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
    amount: toCents(pkg.price_myr),
    currency: "myr",
    customer: stripeCustomerId,
    setup_future_usage: "off_session",
    metadata: { bookingId, kind: "RENTAL_FEE" },
  });

  if (!paymentIntent.client_secret) throw new Error("Stripe did not return a client secret.");

  await supabase.from("payments").insert({
    booking_id: bookingId,
    kind: "RENTAL_FEE",
    provider: "stripe",
    provider_ref: paymentIntent.id,
    amount_myr: pkg.price_myr,
    status: "PENDING",
  });

  return { clientSecret: paymentIntent.client_secret };
}

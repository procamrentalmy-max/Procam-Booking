import "server-only";
import { getStripe, toCents } from "./client";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * Places the security deposit hold: a second PaymentIntent, on the same
 * card the rental fee just used, with capture_method "manual" — this is
 * the authorize-only hold from spec section 6. It only ever gets released
 * (cancelled) or captured later, from the inspection/damage-review flow —
 * never here.
 */
export async function createAndConfirmDepositIntent(bookingId: string, paymentMethodId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const stripe = getStripe();

  const { data: existing } = await supabase
    .from("deposit_authorizations")
    .select("id")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (existing) return; // webhook retry — already placed

  const { data: booking } = await supabase
    .from("bookings")
    .select("customer_id,rental_package_id")
    .eq("id", bookingId)
    .single();
  if (!booking) throw new Error(`Booking ${bookingId} not found`);

  const [{ data: customer }, { data: pkg }] = await Promise.all([
    supabase.from("customers").select("stripe_customer_id").eq("id", booking.customer_id).single(),
    supabase.from("rental_packages").select("deposit_myr").eq("id", booking.rental_package_id).single(),
  ]);
  if (!customer?.stripe_customer_id || !pkg) throw new Error("Booking data is incomplete for the deposit hold.");

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

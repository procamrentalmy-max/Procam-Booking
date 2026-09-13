"use client";

import { useState, type FormEvent } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { Locale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

/** Generic Stripe Elements checkout — shared by any flow that just needs to collect a card against a clientSecret (camera rental fee, photo print orders, ...). */
export function PaymentForm({ clientSecret, returnUrl, locale }: { clientSecret: string; returnUrl: string; locale: Locale }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <CheckoutForm returnUrl={returnUrl} locale={locale} />
    </Elements>
  );
}

function CheckoutForm({ returnUrl, locale }: { returnUrl: string; locale: Locale }) {
  const dict = getDictionary(locale);
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });

    // A successful confirmation redirects the browser to returnUrl itself —
    // this only runs when confirmPayment fails without redirecting.
    if (submitError) {
      setError(submitError.message ?? dict.paymentForm.failed);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {loading ? dict.common.processing : dict.paymentForm.payNow}
      </button>
    </form>
  );
}

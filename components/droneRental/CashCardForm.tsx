"use client";

import { useState, type FormEvent } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

/**
 * A walk-in customer who pays the rental fee in cash still gives their card: it holds the deposit, and a later battery
 * swap or late fee can go on it. This only saves the card (a SetupIntent), nothing is charged. Stripe brings the browser
 * back to returnUrl, which finishes the setup on the server.
 */
export function CashCardForm({ clientSecret, returnUrl }: { clientSecret: string; returnUrl: string }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <SaveCardForm returnUrl={returnUrl} />
    </Elements>
  );
}

function SaveCardForm({ returnUrl }: { returnUrl: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);
    const { error: submitError } = await stripe.confirmSetup({ elements, confirmParams: { return_url: returnUrl } });
    // A successful setup redirects to returnUrl itself; this only runs when it fails without redirecting.
    if (submitError) {
      setError(submitError.message ?? "We couldn't save your card. Please try again.");
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
        {loading ? "Saving…" : "Save my card, pay cash at the shop"}
      </button>
    </form>
  );
}

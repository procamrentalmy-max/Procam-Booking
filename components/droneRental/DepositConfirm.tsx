"use client";

import { useState } from "react";
import { PaymentForm } from "@/components/PaymentForm";
import { startDepositConfirmationAction } from "@/app/rent/b/[token]/pay/actions";

/**
 * Shown on a paid booking whose deposit hold didn't go on by itself (the bank refused it or wants the customer to approve it).
 * The customer confirms it here, with the same card or another one. It is a hold, not a charge.
 */
export function DepositConfirm({ token, depositLabel, returnUrl }: { token: string; depositLabel: string; returnUrl: string }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const { clientSecret: secret } = await startDepositConfirmationAction(token);
      setClientSecret(secret);
    } catch {
      setError("Couldn't start that. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
      <p className="text-base font-semibold text-amber-900 dark:text-amber-200">One more step: confirm your deposit</p>
      <p className="text-sm text-amber-800 dark:text-amber-300">
        Your bank didn&apos;t accept the {depositLabel} deposit hold, so the shop can&apos;t hand over the drone yet. Confirm it here with the same card, or another card.
        It&apos;s only a hold, not a charge, and it&apos;s released when you return the drone in good condition.
      </p>
      {clientSecret ? (
        <PaymentForm clientSecret={clientSecret} returnUrl={returnUrl} locale="en" buttonLabel={`Hold ${depositLabel} deposit`} />
      ) : (
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={start}
            disabled={loading}
            className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? "Please wait…" : "Confirm deposit"}
          </button>
        </>
      )}
    </div>
  );
}

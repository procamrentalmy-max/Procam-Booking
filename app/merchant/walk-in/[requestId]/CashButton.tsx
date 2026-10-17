"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markWalkInPaidCashAction, markWalkInPaidQrAction } from "./actions";
import { pressableClass } from "@/components/formStyles";

/** For a customer who would rather pay at the counter: the merchant takes the rental fee in cash and the order moves on to handover. */
export function CashButton({ requestId, amount, qr = false }: { requestId: string; amount: string; qr?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    const sure = qr
      ? `Only tap OK once the customer has shown you the paid screen from their banking app for ${amount}, and it shows a successful payment from just now.`
      : `Only tap OK once you have the ${amount} in cash in your hand.`;
    if (!window.confirm(sure)) return;
    setBusy(true);
    setError(null);
    try {
      await (qr ? markWalkInPaidQrAction : markWalkInPaidCashAction)(requestId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={run}
        className={`h-12 w-full rounded-xl border text-sm font-semibold disabled:opacity-50 ${pressableClass}`}
      >
        {busy ? "Saving…" : qr ? `Paid screen checked: ${amount} received by QR` : `Customer paid ${amount} in cash`}
      </button>
    </div>
  );
}

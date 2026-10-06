"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markWalkInPaidCashAction } from "./actions";

/** For a customer who would rather pay at the counter: the merchant takes the rental fee in cash and the order moves on to handover. */
export function CashButton({ requestId, amount }: { requestId: string; amount: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!window.confirm(`Only tap OK once you have the ${amount} in cash in your hand.`)) return;
    setBusy(true);
    setError(null);
    try {
      await markWalkInPaidCashAction(requestId);
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
        className="h-12 w-full rounded-xl border border-zinc-300 bg-white text-sm font-semibold text-black disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      >
        {busy ? "Saving…" : `Customer paid ${amount} in cash`}
      </button>
    </div>
  );
}

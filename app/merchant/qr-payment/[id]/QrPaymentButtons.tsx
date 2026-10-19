"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pressableClass } from "@/components/formStyles";
import { cancelQrPaymentAction, confirmQrPaymentAction } from "./actions";

/** Confirm only after the customer's paid screen has been checked; "Not received" closes it (a walk-in rental is then cancelled). */
export function QrPaymentButtons({ id, amount, kind }: { id: string; amount: string; kind: "RENTAL_FEE" | "BATTERY_SWAP_FEE" }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"confirm" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!window.confirm(`Only tap OK once the customer has shown you the paid screen from their banking app for ${amount}, and it shows a successful payment from just now.`)) return;
    setBusy("confirm");
    setError(null);
    try {
      const { next } = await confirmQrPaymentAction(id);
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(null);
    }
  }

  async function cancel() {
    const warning =
      kind === "RENTAL_FEE"
        ? "The payment was not received. This cancels the customer's order and lets the deposit hold on their card go. Cancel the order?"
        : "The payment was not received. The swap does not go ahead. Close this payment?";
    if (!window.confirm(warning)) return;
    setBusy("cancel");
    setError(null);
    try {
      await cancelQrPaymentAction(id);
      router.push("/merchant");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</p>}
      <button
        type="button"
        disabled={busy !== null}
        onClick={confirm}
        className="flex h-14 w-full items-center justify-center rounded-2xl bg-black text-base font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {busy === "confirm" ? "Confirming…" : `Paid screen checked: confirm ${amount}`}
      </button>
      <button type="button" disabled={busy !== null} onClick={cancel} className={`h-12 w-full rounded-xl border text-sm font-semibold disabled:opacity-50 ${pressableClass}`}>
        {busy === "cancel" ? "Closing…" : "Not received"}
      </button>
    </div>
  );
}

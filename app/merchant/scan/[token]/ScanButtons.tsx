"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { primaryButtonClass } from "@/components/formStyles";
import { acceptCheckInAction } from "./actions";

/** Accept order moves straight on to the handover. Cancel changes nothing — it just leaves, so the same QR can be scanned again. */
export function ScanButtons({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const { bookingId } = await acceptCheckInAction(token);
      router.push(`/merchant/pickup/${bookingId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</p>
      )}
      <button type="button" disabled={busy} onClick={accept} className={`w-full ${primaryButtonClass} h-14 rounded-2xl text-base disabled:opacity-50`}>
        {busy ? "Accepting…" : "Accept order"}
      </button>
      <Link
        href="/merchant"
        className="flex h-11 w-full items-center justify-center rounded-xl border border-zinc-300 text-sm font-semibold dark:border-zinc-700"
      >
        Cancel
      </Link>
    </div>
  );
}

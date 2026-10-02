"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButtonClass } from "@/components/formStyles";
import { acceptWalkInAction, declineWalkInAction, cancelWalkInAction } from "./actions";

/** The merchant's decision buttons for a walk-in. `mode` decides which are shown: approving submitted details, or just cancelling an unscanned QR. */
export function WalkInButtons({ requestId, mode }: { requestId: string; mode: "approve" | "cancel" }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "decline" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "accept" | "decline" | "cancel") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "accept") await acceptWalkInAction(requestId);
      else if (kind === "decline") await declineWalkInAction(requestId);
      else await cancelWalkInAction(requestId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  if (mode === "cancel") {
    return (
      <div className="space-y-2">
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run("cancel")}
          className="h-11 w-full rounded-xl border border-zinc-300 text-sm font-semibold disabled:opacity-50 dark:border-zinc-700"
        >
          {busy === "cancel" ? "Cancelling…" : "Cancel this walk-in"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</p>}
      <button type="button" disabled={busy !== null} onClick={() => run("accept")} className={`w-full ${primaryButtonClass} h-14 rounded-2xl text-base disabled:opacity-50`}>
        {busy === "accept" ? "Accepting…" : "Accept this booking"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => run("decline")}
        className="h-11 w-full rounded-xl border border-zinc-300 text-sm font-semibold text-red-700 disabled:opacity-50 dark:border-zinc-700 dark:text-red-400"
      >
        {busy === "decline" ? "Declining…" : "Decline"}
      </button>
    </div>
  );
}

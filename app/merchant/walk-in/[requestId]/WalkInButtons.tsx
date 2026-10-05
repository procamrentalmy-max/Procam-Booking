"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButtonClass } from "@/components/formStyles";
import { confirmWalkInOrderAction, declineWalkInOrderAction } from "./actions";

/**
 * The merchant's decision on a walk-in order. Confirming assigns a free drone automatically (the merchant doesn't
 * choose one); with no free drone only Decline is offered.
 */
export function WalkInButtons({ requestId, droneFree }: { requestId: string; droneFree: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"confirm" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "confirm" | "decline") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "confirm") await confirmWalkInOrderAction(requestId);
      else await declineWalkInOrderAction(requestId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</p>}

      {!droneFree ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          No drone is free for that long right now. Decline this order, or wait for one to come back.
        </p>
      ) : (
        <button type="button" disabled={busy !== null} onClick={() => run("confirm")} className={`w-full ${primaryButtonClass} h-14 rounded-2xl text-base disabled:opacity-50`}>
          {busy === "confirm" ? "Confirming…" : "Confirm order"}
        </button>
      )}

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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { confirmWalkInOrderAction, declineWalkInOrderAction } from "./actions";

/**
 * The merchant's decision on a walk-in order. Confirming picks the drone (the first free one by default,
 * changeable when more than one is free); with no free drone only Decline is offered.
 */
export function WalkInButtons({ requestId, droneOptions }: { requestId: string; droneOptions: { id: string; humanId: string }[] }) {
  const router = useRouter();
  const [droneId, setDroneId] = useState(droneOptions[0]?.id ?? "");
  const [busy, setBusy] = useState<"confirm" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "confirm" | "decline") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "confirm") await confirmWalkInOrderAction(requestId, droneId || undefined);
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

      {droneOptions.length === 0 ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          No drone is free for that long right now. Decline this order, or wait for one to come back.
        </p>
      ) : (
        <>
          {droneOptions.length > 1 && (
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="drone">
                Drone to hand over
              </label>
              <select id="drone" value={droneId} onChange={(e) => setDroneId(e.target.value)} className={`w-full ${inputClass}`}>
                {droneOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.humanId}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button type="button" disabled={busy !== null} onClick={() => run("confirm")} className={`w-full ${primaryButtonClass} h-14 rounded-2xl text-base disabled:opacity-50`}>
            {busy === "confirm" ? "Confirming…" : "Confirm order"}
          </button>
        </>
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

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { completeStopAction, type CompletedStopResult } from "./actions";
import type { NextStop } from "@/lib/worker/route";

const ACTION_LABELS: Record<string, string> = {
  PICKUP: "Pick up",
  DROPOFF: "Drop off",
  SERVICE: "Service (in van)",
};

export function RouteStopView({
  nextStop,
  unmetDropoffs,
  otherPendingPhotoDeliveries,
}: {
  nextStop: NextStop | null;
  unmetDropoffs: { partnerId: string; shortfall: number }[];
  otherPendingPhotoDeliveries: { partnerId: string; partnerName: string; count: number }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompletedStopResult | null>(null);

  async function handleComplete() {
    setError(null);
    setLoading(true);
    try {
      const res = await completeStopAction();
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 pt-6">
        <h1 className="text-center text-xl font-semibold">Stop Complete — {result.partnerName}</h1>

        {result.pickedUp.length > 0 && (
          <Section title="Picked Up">
            <ul className="space-y-1 text-sm">
              {result.pickedUp.map((a) => (
                <li key={a.humanId}>{a.humanId}</li>
              ))}
            </ul>
          </Section>
        )}

        {result.droppedOff.length > 0 && (
          <Section title="Dropped Off — set these PINs on the physical locks">
            <ul className="space-y-2 text-sm">
              {result.droppedOff.map((a) => (
                <li key={a.humanId} className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <span>
                    {a.humanId} — Compartment {a.compartmentNumber}
                  </span>
                  <span className="font-mono text-lg font-bold">{a.pin}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {result.toInspect.length > 0 && (
          <Section title="Ready for Inspection">
            <ul className="space-y-1 text-sm">
              {result.toInspect.map((a) => (
                <li key={a.assetId}>
                  <Link href={`/staff/inspections/${a.assetId}`} className="underline underline-offset-2">
                    {a.humanId} — Start Inspection
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {result.photoOrdersDelivered.length > 0 && (
          <Section title="Photo Prints Delivered — set these into their slots">
            <ul className="space-y-1 text-sm">
              {result.photoOrdersDelivered.map((o, i) => (
                <li key={i}>
                  {o.customerName} — {o.slotNumber !== null ? `Slot ${o.slotNumber}` : "Wooden Box (50 slots were full)"}{" "}
                  (collect by {o.collectBy})
                </li>
              ))}
            </ul>
          </Section>
        )}

        <button
          onClick={() => router.refresh()}
          className="w-full rounded-full bg-black py-3 font-semibold text-white dark:bg-white dark:text-black"
        >
          Next Stop
        </button>
      </div>
    );
  }

  if (!nextStop) {
    return (
      <div className="pt-8 text-center text-sm text-zinc-500">
        <p>Nothing to do right now.</p>
        {unmetDropoffs.length > 0 && (
          <p className="mt-2 text-red-600">
            {unmetDropoffs.length} location{unmetDropoffs.length > 1 ? "s" : ""} short on cameras with nothing available to cover it.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 pt-6">
      <h1 className="text-center text-xl font-semibold">Next Stop: {nextStop.partnerName}</h1>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      {nextStop.actions.map((action, i) => (
        <Section key={i} title={ACTION_LABELS[action.type] ?? action.type}>
          <ul className="space-y-1 text-sm">
            {action.assets.map((a) => (
              <li key={a.id}>{a.humanId}</li>
            ))}
          </ul>
        </Section>
      ))}

      {nextStop.photoOrders.length > 0 && (
        <Section title="Deliver Photo Prints">
          <ul className="space-y-1 text-sm">
            {nextStop.photoOrders.map((o) => (
              <li key={o.id}>
                {o.customerName} — {o.quantity} × {o.size} — {o.slotNumber !== null ? `Slot ${o.slotNumber}` : "Wooden Box"}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {unmetDropoffs.length > 0 && (
        <p className="text-center text-xs text-red-600">
          {unmetDropoffs.length} other location{unmetDropoffs.length > 1 ? "s" : ""} still short on cameras after this stop.
        </p>
      )}

      {otherPendingPhotoDeliveries.length > 0 && (
        <p className="text-center text-xs text-zinc-400">
          Also waiting: {otherPendingPhotoDeliveries.map((d) => `${d.partnerName} (${d.count})`).join(", ")}
        </p>
      )}

      <button
        onClick={handleComplete}
        disabled={loading}
        className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {loading ? "Completing…" : "Mark Stop Complete"}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

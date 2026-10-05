"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButtonClass } from "@/components/formStyles";
import { formatMyr, isBatteryCount, type BatteryCount } from "@/lib/droneRental/pricingRules";
import { submitBatterySwapAction } from "./actions";

export function BatterySwapForm({
  bookingId,
  heldBatteries,
  replacements,
  batteryFees,
}: {
  bookingId: string;
  /** What the customer is holding now, by name. */
  heldBatteries: { id: string; label: string }[];
  /** Charged batteries at the shop to give in exchange, in the order they'll be used. */
  replacements: { id: string; label: string }[];
  /** What swapping 1 or 2 batteries costs for this booking's drone model. */
  batteryFees: Record<BatteryCount, number>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(heldBatteries[0] ? [heldBatteries[0].id] : []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const count = selected.length;
  const fee = isBatteryCount(count) ? batteryFees[count] : 0;

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("bookingId", bookingId);
      for (const id of selected) formData.append("returnedBatteryIds", id);
      for (const r of replacements.slice(0, count)) formData.append("replacementIds", r.id);
      await submitBatterySwapAction(formData);
      router.push("/merchant");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  if (heldBatteries.length === 0) {
    return <p className="text-center text-sm text-zinc-400">No batteries are currently checked out to this booking.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {heldBatteries.map((b) => (
          <label key={b.id} className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <input type="checkbox" checked={selected.includes(b.id)} onChange={() => toggle(b.id)} className="h-4 w-4" />
            Return {b.label}
          </label>
        ))}
      </div>
      {count > 0 &&
        (replacements.length >= count ? (
          <div className="rounded-2xl border-2 border-black p-4 dark:border-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Give them</p>
            <p className="mt-1 text-xl font-bold text-black dark:text-zinc-50">{replacements.slice(0, count).map((r) => r.label).join(" and ")}</p>
          </div>
        ) : (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {replacements.length === 0
              ? "No charged battery is at the shop right now."
              : `Only ${replacements.length} charged ${replacements.length === 1 ? "battery is" : "batteries are"} at the shop right now. Swap ${replacements.length} instead.`}
          </p>
        ))}
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
      <button
        type="button"
        disabled={loading || count === 0}
        onClick={submit}
        className={`w-full ${primaryButtonClass} h-12 rounded-full disabled:opacity-50`}
      >
        {loading ? `Charging ${formatMyr(fee)}…` : count === 0 ? "Pick the batteries being returned" : `Swap ${count} ${count === 1 ? "battery" : "batteries"} (charge ${formatMyr(fee)})`}
      </button>
    </div>
  );
}

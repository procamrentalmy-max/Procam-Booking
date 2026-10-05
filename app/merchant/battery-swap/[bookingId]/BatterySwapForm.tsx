"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButtonClass } from "@/components/formStyles";
import { BatteryPicker, useBatteryPicks, type BatteryOption } from "@/components/droneRental/BatteryPicker";
import { formatMyr, isBatteryCount, type BatteryCount } from "@/lib/droneRental/pricingRules";
import { submitBatterySwapAction } from "./actions";

export function BatterySwapForm({
  bookingId,
  heldBatteries,
  options,
  batteryFees,
}: {
  bookingId: string;
  /** What the customer is holding now, by name. */
  heldBatteries: BatteryOption[];
  /** Every charged battery at the shop that fits this drone, to pick from. */
  options: BatteryOption[];
  /** What swapping 1 or 2 batteries costs for this booking's drone model. */
  batteryFees: Record<BatteryCount, number>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(heldBatteries[0] ? [heldBatteries[0].id] : []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const count = selected.length;
  const fee = isBatteryCount(count) ? batteryFees[count] : 0;
  // As many batteries go out as come back.
  const { give, pick, enough, ready } = useBatteryPicks(options, count);

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
      for (const id of give) formData.append("replacementIds", id);
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
        <p className="text-sm font-medium">Batteries coming back</p>
        {heldBatteries.map((b) => (
          <label key={b.id} className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <input type="checkbox" checked={selected.includes(b.id)} onChange={() => toggle(b.id)} className="h-4 w-4" />
            Return {b.label}
          </label>
        ))}
      </div>

      {count > 0 &&
        (enough ? (
          <BatteryPicker options={options} count={count} give={give} onPick={pick} verb="give" />
        ) : (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {options.length === 0
              ? "No charged battery is at the shop right now."
              : `Only ${options.length} charged ${options.length === 1 ? "battery is" : "batteries are"} at the shop right now. Swap ${options.length} instead.`}
          </p>
        ))}

      {error && <p className="text-center text-sm text-red-600">{error}</p>}
      <button type="button" disabled={loading || !ready} onClick={submit} className={`w-full ${primaryButtonClass} h-12 rounded-full disabled:opacity-50`}>
        {loading
          ? `Charging ${formatMyr(fee)}…`
          : count === 0
            ? "Pick the batteries being returned"
            : !enough
              ? "Not enough charged batteries"
              : `Swap ${count} ${count === 1 ? "battery" : "batteries"} (charge ${formatMyr(fee)})`}
      </button>
    </div>
  );
}

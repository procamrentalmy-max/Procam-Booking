"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButtonClass } from "@/components/formStyles";
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
  heldBatteries: { id: string; label: string }[];
  /** Every charged battery at the shop that fits this drone, to pick from. */
  options: { id: string; label: string }[];
  /** What swapping 1 or 2 batteries costs for this booking's drone model. */
  batteryFees: Record<BatteryCount, number>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(heldBatteries[0] ? [heldBatteries[0].id] : []);
  // The batteries the merchant has tapped to give, oldest first. Everything below happens on this page, with no reload.
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const count = selected.length;
  const fee = isBatteryCount(count) ? batteryFees[count] : 0;

  // As many batteries go out as come back. The first few charged ones are picked to start with so the merchant
  // can just confirm; tapping another switches (the oldest pick drops off once the limit is reached).
  const optionIds = options.map((o) => o.id);
  const keep = picked.filter((id) => optionIds.includes(id)).slice(-count);
  const fill = optionIds.filter((id) => !keep.includes(id)).slice(0, Math.max(0, count - keep.length));
  const give = [...keep, ...fill].slice(0, count);
  const enough = options.length >= count;
  const ready = count > 0 && enough && give.length === count;

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function pick(id: string) {
    if (give.includes(id)) return;
    setPicked([...give, id].slice(-count));
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
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {count === 1 ? "Pick the battery to give" : `Pick the ${count} batteries to give`}
              <span className="font-normal text-zinc-500">
                {" "}
                · {give.length} of {count} picked
              </span>
            </p>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Charged batteries at the shop">
              {options.map((o) => {
                const on = give.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => pick(o.id)}
                    className={`h-14 rounded-xl border text-lg font-bold ${
                      on ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-zinc-300 text-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-zinc-500">Charged batteries at the shop. Tap one to give it, or tap another to switch.</p>
          </div>
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

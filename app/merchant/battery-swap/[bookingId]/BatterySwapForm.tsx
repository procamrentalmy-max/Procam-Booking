"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButtonClass } from "@/components/formStyles";
import { BATTERY_PACKAGE_FEE_MYR, formatMyr, isBatteryCount } from "@/lib/droneRental/pricingRules";
import { submitBatterySwapAction } from "./actions";

export function BatterySwapForm({ bookingId, heldBatteries }: { bookingId: string; heldBatteries: { id: string; human_id: string }[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(heldBatteries[0] ? [heldBatteries[0].id] : []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const count = selected.length;
  const fee = isBatteryCount(count) ? BATTERY_PACKAGE_FEE_MYR[count] : 0;

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
            Return {b.human_id}
          </label>
        ))}
      </div>
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

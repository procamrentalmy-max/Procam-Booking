"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButtonClass } from "@/components/formStyles";
import { submitBatterySwapAction } from "./actions";

export function BatterySwapForm({ bookingId, heldBatteries }: { bookingId: string; heldBatteries: { id: string; human_id: string }[] }) {
  const router = useRouter();
  const [returnedBatteryId, setReturnedBatteryId] = useState<string>(heldBatteries[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("bookingId", bookingId);
      formData.set("returnedBatteryId", returnedBatteryId);
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
          <label key={b.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <input type="radio" name="returnedBattery" checked={returnedBatteryId === b.id} onChange={() => setReturnedBatteryId(b.id)} />
            Return {b.human_id}
          </label>
        ))}
      </div>
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
      <button type="button" disabled={loading} onClick={submit} className={`w-full ${primaryButtonClass} h-12 rounded-full disabled:opacity-50`}>
        {loading ? "Charging RM6…" : "Swap battery (charge RM6)"}
      </button>
    </div>
  );
}

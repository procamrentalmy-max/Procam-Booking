"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButtonClass } from "@/components/formStyles";
import { PayMethodChoice } from "@/components/droneRental/PayMethodChoice";
import type { DrPaidBy } from "@/lib/db/types";
import { BatteryPicker, useBatteryPicks, type BatteryOption } from "@/components/droneRental/BatteryPicker";
import { formatMyr, isBatteryCount, type BatteryCount } from "@/lib/droneRental/pricingRules";
import { submitBatterySwapAction } from "./actions";

export function BatterySwapForm({
  bookingId,
  swapShopId,
  heldBatteries,
  options,
  batteryFees,
  paidByQr = null,
}: {
  bookingId: string;
  /** The shop doing the swap (the one this merchant is at). */
  swapShopId: string;
  /** What the customer is holding now, by name. */
  heldBatteries: BatteryOption[];
  /** Every charged battery at the shop that fits this drone, to pick from. */
  options: BatteryOption[];
  /** What swapping 1 or 2 batteries costs for this booking's drone model. */
  batteryFees: Record<BatteryCount, number>;
  /** The customer paid this swap by QR and the merchant confirmed it: this many batteries are paid for, and no other way of paying is offered. */
  paidByQr?: { count: number; amount: number } | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(heldBatteries.slice(0, paidByQr?.count ?? 1).map((b) => b.id));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [payMethod, setPayMethod] = useState<DrPaidBy>(paidByQr ? "QR" : "CARD");

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
      formData.set("swapShopId", swapShopId);
      formData.set("paidBy", payMethod);
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

      {paidByQr ? (
        <p className="rounded-xl border border-green-300 bg-green-50 p-3 text-center text-sm font-semibold text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100">
          Paid by QR: {formatMyr(paidByQr.amount)} for {paidByQr.count} {paidByQr.count === 1 ? "battery" : "batteries"}, confirmed. Hand over the batteries.
        </p>
      ) : (
        <PayMethodChoice label="How does the customer pay the swap fee?" value={payMethod} onChange={setPayMethod} />
      )}
      {payMethod === "CASH" && count > 0 && <p className="text-center text-sm font-semibold text-amber-700 dark:text-amber-400">Take {formatMyr(fee)} in cash before you hand over the batteries.</p>}

      {error && <p className="text-center text-sm text-red-600">{error}</p>}
      <button type="button" disabled={loading || !ready || (!!paidByQr && count !== paidByQr.count)} onClick={submit} className={`w-full ${primaryButtonClass} h-12 rounded-full disabled:opacity-50`}>
        {loading
          ? `Saving ${formatMyr(fee)}…`
          : count === 0
            ? "Pick the batteries being returned"
            : !enough
              ? "Not enough charged batteries"
              : paidByQr && count !== paidByQr.count
                ? `Swap exactly ${paidByQr.count} ${paidByQr.count === 1 ? "battery" : "batteries"}, as paid`
                : payMethod === "QR"
                  ? `Swap ${count} ${count === 1 ? "battery" : "batteries"} (paid by QR)`
                  : `Swap ${count} ${count === 1 ? "battery" : "batteries"} (${payMethod === "CASH" ? "cash" : "charge"} ${formatMyr(fee)})`}
      </button>
    </div>
  );
}

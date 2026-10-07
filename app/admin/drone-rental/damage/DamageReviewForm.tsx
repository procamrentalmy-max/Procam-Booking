"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { formatMyr } from "@/lib/droneRental/pricingRules";
import { reviewDamageAction } from "./actions";

export type ReviewItem = {
  key: "drone" | "controller";
  title: string;
  outcome: "DAMAGED" | "LOST" | "NONE";
  /** What is held on the card for this item: the most that can be kept for it. */
  heldMyr: number;
};

/** One booking's review: an amount to type next to each damaged item, and the exact total that will be captured. */
export function DamageReviewForm({ bookingId, items, holdFound }: { bookingId: string; items: ReviewItem[]; holdFound: boolean }) {
  const router = useRouter();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const typed = (key: string) => {
    const n = Number(amounts[key]);
    return amounts[key] !== undefined && amounts[key] !== "" && Number.isFinite(n) && n > 0 ? n : 0;
  };
  const keptFor = (item: ReviewItem) => (item.outcome === "LOST" ? item.heldMyr : item.outcome === "DAMAGED" ? Math.min(typed(item.key), item.heldMyr) : 0);
  const total = items.reduce((sum, item) => sum + keptFor(item), 0);
  const held = items.reduce((sum, item) => sum + item.heldMyr, 0);
  const tooMuch = items.some((item) => item.outcome === "DAMAGED" && typed(item.key) > item.heldMyr);

  async function submit() {
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.set("bookingId", bookingId);
    for (const item of items) if (item.outcome === "DAMAGED") formData.set(`${item.key}Amount`, amounts[item.key] ?? "");
    const result = await reviewDamageAction(formData);
    if (result.ok) {
      setDone(
        result.holdFound
          ? result.capturedMyr > 0
            ? `${formatMyr(result.capturedMyr)} captured from the deposit; the rest was released.`
            : "Nothing charged: the whole deposit was released."
          : `No card hold was on file, so nothing was captured. ${result.capturedMyr > 0 ? `Collect ${formatMyr(result.capturedMyr)} another way.` : ""}`
      );
      router.refresh();
      return;
    }
    setError(result.message);
    setLoading(false);
  }

  if (done) return <p className="rounded-xl border border-green-300 bg-green-50 p-3 text-sm font-medium text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200">{done}</p>;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-3"
    >
      {items
        .filter((item) => item.outcome !== "NONE")
        .map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <div>
              <p className="text-sm font-semibold text-black dark:text-zinc-50">{item.title}</p>
              <p className="text-xs text-zinc-500">
                <span className={item.outcome === "LOST" ? "font-semibold text-red-700 dark:text-red-400" : "font-semibold text-amber-700 dark:text-amber-400"}>{item.outcome === "LOST" ? "Lost" : "Damaged"}</span> · {formatMyr(item.heldMyr)} held
              </p>
            </div>
            {item.outcome === "DAMAGED" ? (
              <label className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500">RM</span>
                <input
                  inputMode="decimal"
                  value={amounts[item.key] ?? ""}
                  onChange={(e) => setAmounts({ ...amounts, [item.key]: e.target.value })}
                  placeholder="0"
                  aria-label={`Amount to keep for the ${item.title}`}
                  className={`w-28 text-right ${inputClass}`}
                />
              </label>
            ) : (
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">{formatMyr(item.heldMyr)} kept in full</p>
            )}
          </div>
        ))}

      <div className="flex items-end justify-between gap-4 rounded-xl bg-zinc-100 p-3 dark:bg-zinc-900">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Capture from the deposit</p>
          <p className="text-2xl font-bold tabular-nums text-black dark:text-zinc-50">{formatMyr(total)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Release to customer</p>
          <p className="text-lg font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">{formatMyr(Math.max(0, held - total))}</p>
        </div>
      </div>

      {!holdFound && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          There is no card hold on file for this booking, so nothing can be captured automatically.
        </p>
      )}
      {tooMuch && <p className="text-sm text-red-600">An amount can&apos;t be more than what is held for that item.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={loading || tooMuch} className={`w-full ${primaryButtonClass} h-12 rounded-full disabled:opacity-50`}>
        {loading ? "Capturing…" : total > 0 ? `Capture ${formatMyr(total)} and finish` : "Charge nothing and release the deposit"}
      </button>
    </form>
  );
}

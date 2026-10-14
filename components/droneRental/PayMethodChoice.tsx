"use client";

import type { DrPaidBy } from "@/lib/db/types";
import { pressableClass } from "@/components/formStyles";

/** Card or cash for one payment. Each payment on a booking (the rental fee, a swap, a late fee) is chosen on its own. */
export function PayMethodChoice({ label, value, onChange }: { label: string; value: DrPaidBy; onChange: (next: DrPaidBy) => void }) {
  const options: { key: DrPaidBy; text: string }[] = [
    { key: "CARD", text: "Saved card" },
    { key: "CASH", text: "Cash" },
  ];
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={value === o.key}
            onClick={() => onChange(o.key)}
            className={`h-11 rounded-xl border text-sm font-semibold ${
              value === o.key ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : pressableClass
            }`}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

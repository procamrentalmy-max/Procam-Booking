"use client";

import { useState } from "react";

/** One line of the earnings table. With `info`, a small i button next to the name opens a short explanation under the line. */
export function EarningsRow({ label, value, strong, highlight, info }: { label: string; value: string; strong?: boolean; highlight?: boolean; info?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-b border-zinc-100 last:border-b-0 dark:border-zinc-800 ${highlight ? "bg-emerald-50 dark:bg-emerald-950" : ""}`}>
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <span className={`flex items-center gap-1.5 ${strong ? "font-semibold text-black dark:text-zinc-50" : "text-zinc-600 dark:text-zinc-400"}`}>
          {label}
          {info && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={`What is ${label}?`}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-400 text-[11px] font-bold italic leading-none text-zinc-500 dark:border-zinc-500 dark:text-zinc-400"
            >
              i
            </button>
          )}
        </span>
        <span className={`tabular-nums ${strong ? "font-semibold text-black dark:text-zinc-50" : "text-zinc-700 dark:text-zinc-300"}`}>{value}</span>
      </div>
      {info && open && <p className="bg-zinc-50 px-3 pb-3 pt-2 text-xs leading-relaxed text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">{info}</p>}
    </div>
  );
}

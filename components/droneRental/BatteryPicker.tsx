"use client";

import { useState } from "react";

export type BatteryOption = { id: string; label: string };

/**
 * Which batteries the merchant has chosen to give out. As many as are needed (`count`); the first charged ones are
 * chosen to start with so the merchant can just confirm, and tapping another switches (once the limit is reached the
 * oldest pick drops off). All of it is client state on the page, so nothing reloads.
 */
export function useBatteryPicks(options: BatteryOption[], count: number) {
  const [picked, setPicked] = useState<string[]>([]);
  const optionIds = options.map((o) => o.id);
  const keep = count > 0 ? picked.filter((id) => optionIds.includes(id)).slice(-count) : [];
  const fill = optionIds.filter((id) => !keep.includes(id)).slice(0, Math.max(0, count - keep.length));
  const give = [...keep, ...fill].slice(0, count);

  function pick(id: string) {
    if (give.includes(id)) return;
    setPicked([...give, id].slice(-count));
  }

  return { give, pick, enough: options.length >= count, ready: count > 0 && options.length >= count && give.length === count };
}

/** The tap-to-pick list of charged batteries at the shop. `verb` finishes "Pick the battery to ..." ("give", "hand out"). */
export function BatteryPicker({
  options,
  count,
  give,
  onPick,
  verb,
}: {
  options: BatteryOption[];
  count: number;
  give: string[];
  onPick: (id: string) => void;
  verb: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {count === 1 ? `Pick the battery to ${verb}` : `Pick the ${count} batteries to ${verb}`}
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
              onClick={() => onPick(o.id)}
              className={`h-14 rounded-xl border text-lg font-bold ${
                on ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-zinc-300 text-zinc-800 dark:border-zinc-700 dark:text-zinc-200"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-zinc-500">Charged batteries at the shop. Tap one to choose it, or tap another to switch.</p>
    </div>
  );
}

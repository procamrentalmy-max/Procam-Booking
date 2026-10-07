"use client";

import { CONTROLLER_PROFILES, controllerProfileFor, formatMyr, type ControllerKind } from "@/lib/droneRental/pricingRules";

const selectedClass = "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black";
const idleClass = "border-zinc-300 dark:border-zinc-700";
const unavailableClass = "cursor-not-allowed border-zinc-200 text-zinc-300 dark:border-zinc-800 dark:text-zinc-700";

/** What each way of flying adds per hour on its own (the drone's price is shown separately), for this drone. */
function extraPerHour(model: string, kind: ControllerKind): number {
  return controllerProfileFor(model, kind)?.hourlyMyr ?? 0;
}

/**
 * The choice between flying from your phone, the RC-N3 controller or the goggles set, each with only its own price per hour.
 * A controller the shop has none of (or has out on another rental) is still listed but greyed out and can't be picked:
 * `unavailable` is those.
 */
export function ControllerChoice({
  model,
  options,
  value,
  onChange,
  unavailable = [],
}: {
  model: string;
  options: readonly ControllerKind[];
  value: ControllerKind;
  onChange: (next: ControllerKind) => void;
  unavailable?: readonly ControllerKind[];
}) {
  if (options.length < 2) return null;
  return (
    <div>
      <p className="mb-2 text-sm font-medium">How will you fly it?</p>
      <div className={`grid gap-2 ${options.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
        {options.map((o) => {
          const off = unavailable.includes(o);
          return (
            <button
              key={o}
              type="button"
              disabled={off}
              onClick={() => onChange(o)}
              aria-pressed={value === o}
              className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-3 text-center ${off ? unavailableClass : value === o ? selectedClass : idleClass}`}
            >
              <span className="text-sm font-semibold leading-tight">{o === "NONE" ? "Phone only" : (controllerProfileFor(model, o)?.shortName ?? CONTROLLER_PROFILES[o].shortName)}</span>
              <span className={`text-xs tabular-nums ${off ? "" : value === o ? "opacity-80" : "text-zinc-500"}`}>{formatMyr(extraPerHour(model, o))} per hour</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

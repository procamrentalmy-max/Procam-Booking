"use client";

import { DRONE_MODEL_PROFILES, formatMyr, type DroneModel } from "@/lib/droneRental/pricingRules";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";

const selectedClass = "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black";
const idleClass = "border-zinc-300 dark:border-zinc-700";
const unavailableClass = "cursor-not-allowed border-zinc-200 text-zinc-300 dark:border-zinc-800 dark:text-zinc-700";

/**
 * The choice between drones, each with its price per hour. A drone the shop has none of is still listed but greyed out and
 * can't be picked. `unavailable` is those drones (and, at a walk-in QR, any with no length left to offer).
 */
export function DroneChoice({
  models,
  value,
  onChange,
  unavailable = [],
  locale = "en",
}: {
  locale?: Locale;
  models: readonly DroneModel[];
  value: DroneModel;
  onChange: (next: DroneModel) => void;
  unavailable?: readonly DroneModel[];
}) {
  if (models.length < 2) return null;
  const t = droneText(locale);
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{t.choice.whichDrone}</p>
      <div className="grid grid-cols-2 gap-2">
        {models.map((m) => {
          const off = unavailable.includes(m);
          return (
            <button
              key={m}
              type="button"
              disabled={off}
              onClick={() => onChange(m)}
              aria-pressed={value === m}
              className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-3 text-center ${off ? unavailableClass : value === m ? selectedClass : idleClass}`}
            >
              <span className="text-sm font-semibold leading-tight">{DRONE_MODEL_PROFILES[m].shortName}</span>
              <span className={`text-xs tabular-nums ${off || value !== m ? "" : "opacity-80"} ${off ? "" : value === m ? "" : "text-zinc-500"}`}>
                {t.common.perHour(formatMyr(DRONE_MODEL_PROFILES[m].hourlyRateMyr))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

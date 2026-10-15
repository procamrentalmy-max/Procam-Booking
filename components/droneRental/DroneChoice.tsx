"use client";

import { DRONE_MODEL_PROFILES, formatMyr, type DroneModel } from "@/lib/droneRental/pricingRules";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";
import { useState } from "react";
import type { CompareData } from "@/lib/droneRental/compareTables";
import { choiceStyles } from "./choiceStyles";
import { CompareDialog } from "./CompareDialog";

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
  onDark = false,
  label,
  compare,
  unavailableLabel,
}: {
  locale?: Locale;
  /** The landing page is always dark. */
  onDark?: boolean;
  /** Replaces "Which drone?". */
  label?: string;
  /** The comparison table for a Compare button beside the label; without it there is no button. */
  compare?: CompareData<DroneModel>;
  /** What an unavailable choice says in the Compare view (default "Not at this shop"; the home page has no shop, so it says "Not available right now"). */
  unavailableLabel?: string;
  models: readonly DroneModel[];
  /** Null while nothing has been picked yet (the landing page starts that way). */
  value: DroneModel | null;
  onChange: (next: DroneModel) => void;
  unavailable?: readonly DroneModel[];
}) {
  const [comparing, setComparing] = useState(false);
  if (models.length < 2) return null;
  const t = droneText(locale);
  const st = choiceStyles(onDark);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{label ?? t.choice.whichDrone}</p>
        {compare && (
          <button type="button" onClick={() => setComparing(true)} className={`text-xs font-medium underline underline-offset-4 ${onDark ? "text-slate-200 hover:text-white" : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white"}`}>
            {t.common.compare}
          </button>
        )}
      </div>
      {compare && <CompareDialog open={comparing} onClose={() => setComparing(false)} data={compare} value={value} unavailable={unavailable} onChoose={onChange} locale={locale} unavailableText={unavailableLabel} />}
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
              className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-3 text-center ${off ? st.unavailable : value === m ? st.selected : st.idle}`}
            >
              <span className="text-sm font-semibold leading-tight">{DRONE_MODEL_PROFILES[m].shortName}</span>
              <span className={`text-xs tabular-nums ${off || value !== m ? "" : "opacity-80"} ${off ? "" : value === m ? "" : st.sub}`}>
                {t.common.perHour(formatMyr(DRONE_MODEL_PROFILES[m].hourlyRateMyr))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

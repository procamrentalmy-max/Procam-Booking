"use client";

import { formatMyr } from "@/lib/droneRental/pricingRules";
import { DRONE_ID_CHECK_ENABLED } from "@/lib/features";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";

/**
 * The choice to verify identity (a photo of the MyKad or passport and a selfie, run by Didit) and have only 40% of the deposit held.
 * Not ticked, the full deposit is held and nothing is checked. Shows nothing while the ID check is switched off (lib/features.ts).
 */
export function IdCheckOption({ checked, onChange, fullMyr, reducedMyr, locale = "en" }: { checked: boolean; onChange: (next: boolean) => void; fullMyr: number; reducedMyr: number; locale?: Locale }) {
  if (!DRONE_ID_CHECK_ENABLED) return null;
  const t = droneText(locale).kyc;
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 ${checked ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60" : "border-zinc-300 dark:border-zinc-700"}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-emerald-600" />
      <span className="min-w-0">
        <span className={`block text-sm font-bold leading-snug ${checked ? "text-emerald-950 dark:text-emerald-50" : ""}`}>{t.optionTitle}</span>
        <span className="mt-0.5 block text-xs leading-snug text-zinc-500">{t.optionText(formatMyr(reducedMyr), formatMyr(fullMyr))}</span>
      </span>
    </label>
  );
}

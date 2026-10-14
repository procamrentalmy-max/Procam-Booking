"use client";

import { BATTERY_OPTIONS, DRONE_MODEL_PROFILES, formatMyr, type BatteryCount, type DroneModel } from "@/lib/droneRental/pricingRules";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";
import { ONLINE_MAX_HOURS } from "@/lib/legal";
import { choiceStyles } from "./choiceStyles";

export const DURATION_OPTIONS_HOURS = Array.from({ length: ONLINE_MAX_HOURS }, (_, i) => i + 1);

/** "How long do you need it?": 1 to 6 hours, each with what that costs for the drone and way of flying chosen. `value` is null until one is picked. */
export function DurationChoice({ value, hourly, onChange, locale = "en", onDark = false }: { value: number | null; hourly: number; onChange: (hours: number) => void; locale?: Locale; onDark?: boolean }) {
  const t = droneText(locale);
  const st = choiceStyles(onDark);
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{t.wizard.howLong}</p>
      <div className="grid grid-cols-3 gap-2">
        {DURATION_OPTIONS_HOURS.map((h) => (
          <button key={h} type="button" onClick={() => onChange(h)} aria-pressed={value === h} className={`rounded-xl border py-3 text-center ${value === h ? st.selected : st.idle}`}>
            <span className="block text-sm font-semibold">{t.common.hours(h)}</span>
            <span className={`block text-xs ${value === h ? "opacity-80" : st.sub}`}>{formatMyr(h * hourly)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** "How many batteries?": 1 or 2, each with its price and about how long it flies. `value` is null until one is picked. */
export function BatteryChoice({ model, value, onChange, locale = "en", onDark = false }: { model: DroneModel; value: BatteryCount | null; onChange: (n: BatteryCount) => void; locale?: Locale; onDark?: boolean }) {
  const t = droneText(locale);
  const st = choiceStyles(onDark);
  const profile = DRONE_MODEL_PROFILES[model];
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{t.wizard.howMany}</p>
      <div className="grid grid-cols-2 gap-2">
        {BATTERY_OPTIONS.map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} aria-pressed={value === n} className={`rounded-xl border px-3 py-3 text-center ${value === n ? st.selected : st.idle}`}>
            <span className="block text-sm font-semibold">
              {t.common.batteries(n)} · {formatMyr(profile.batteryFeeMyr[n])}
            </span>
            {profile.flightMinutes && <span className={`block text-xs ${value === n ? "opacity-80" : st.sub}`}>{t.wizard.flightNote(profile.flightMinutes[n])}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

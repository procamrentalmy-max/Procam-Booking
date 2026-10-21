"use client";

import { useState } from "react";
import {
  BATTERY_OPTIONS,
  DAY_MINUTES,
  DRONE_MODEL_PROFILES,
  MAX_RENTAL_DAYS,
  MULTI_DAY_DISCOUNT_PERCENT,
  dailyFeeMyr,
  dailyRateFor,
  formatMyr,
  hourlyRateFor,
  isDailyMinutes,
  offersDaily,
  type BatteryCount,
  type ControllerKind,
  type DroneModel,
} from "@/lib/droneRental/pricingRules";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";
import { ONLINE_MAX_HOURS } from "@/lib/legal";
import { choiceStyles } from "./choiceStyles";

export const DURATION_OPTIONS_HOURS = Array.from({ length: ONLINE_MAX_HOURS }, (_, i) => i + 1);

export const DAY_OPTIONS = Array.from({ length: MAX_RENTAL_DAYS }, (_, i) => i + 1);

/**
 * "How long do you need it?": by the hour (1 to 6, each with what that costs for the drone and way of flying chosen) or, where this drone and way of
 * flying have a daily rate, by the day (1 to 3, the batteries and a charger included, 10% off for every extra day). `minutes` is null until one is picked.
 */
export function LengthChoice({
  minutes,
  model,
  controller,
  onChange,
  locale = "en",
  onDark = false,
}: {
  minutes: number | null;
  model: DroneModel;
  controller: ControllerKind;
  onChange: (minutes: number) => void;
  locale?: Locale;
  onDark?: boolean;
}) {
  const t = droneText(locale);
  const st = choiceStyles(onDark);
  const canDaily = offersDaily(model, controller);
  const [pickedMode, setPickedMode] = useState<"hour" | "day">("hour");
  const mode: "hour" | "day" = canDaily ? (minutes !== null ? (isDailyMinutes(minutes) ? "day" : "hour") : pickedMode) : "hour";
  const hourly = hourlyRateFor(model, controller);
  const perDay = dailyRateFor(model, controller);
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{mode === "day" ? t.wizard.howManyDays : t.wizard.howLong}</p>
      {canDaily && (
        <div className="mb-2 grid grid-cols-2 gap-2" role="group" aria-label={t.wizard.howLong}>
          {(["hour", "day"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setPickedMode(m);
                onChange(m === "day" ? DAY_MINUTES : 60);
              }}
              aria-pressed={mode === m}
              className={`rounded-xl border py-2.5 text-center text-sm font-semibold ${mode === m ? st.selected : st.idle}`}
            >
              {m === "day" ? t.wizard.byDay : t.wizard.byHour}
            </button>
          ))}
        </div>
      )}
      {mode === "hour" ? (
        <div className="grid grid-cols-3 gap-2">
          {DURATION_OPTIONS_HOURS.map((h) => (
            <button key={h} type="button" onClick={() => onChange(h * 60)} aria-pressed={minutes === h * 60} className={`rounded-xl border py-3 text-center ${minutes === h * 60 ? st.selected : st.idle}`}>
              <span className="block text-sm font-semibold">{t.common.hours(h)}</span>
              <span className={`block text-xs ${minutes === h * 60 ? "opacity-80" : st.sub}`}>{formatMyr(h * hourly)}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {DAY_OPTIONS.map((d) => (
              <button key={d} type="button" onClick={() => onChange(d * DAY_MINUTES)} aria-pressed={minutes === d * DAY_MINUTES} className={`rounded-xl border py-3 text-center ${minutes === d * DAY_MINUTES ? st.selected : st.idle}`}>
                <span className="block text-sm font-semibold">{t.common.days(d)}</span>
                <span className={`block text-xs ${minutes === d * DAY_MINUTES ? "opacity-80" : st.sub}`}>{formatMyr(dailyFeeMyr(d, model, controller) ?? 0)}</span>
                <span className={`block text-xs ${minutes === d * DAY_MINUTES ? "opacity-80" : st.sub}`}>{d === 1 && perDay !== null ? t.wizard.perDay(formatMyr(perDay)) : t.wizard.savePct(MULTI_DAY_DISCOUNT_PERCENT * (d - 1))}</span>
              </button>
            ))}
          </div>
          <p className={`mt-2 text-xs leading-snug ${st.sub}`}>
            {t.wizard.dailyIncludes} · {t.wizard.dailyDiscount}. {t.wizard.dailyReturn}
          </p>
        </>
      )}
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

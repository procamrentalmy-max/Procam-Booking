"use client";

import { CONTROLLER_PROFILES, controllerProfileFor, formatMyr, type ControllerKind } from "@/lib/droneRental/pricingRules";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";
import { choiceStyles } from "./choiceStyles";

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
  locale = "en",
  onDark = false,
  label,
}: {
  locale?: Locale;
  /** The landing page is always dark. */
  onDark?: boolean;
  /** Replaces "How will you fly it?". */
  label?: string;
  model: string;
  options: readonly ControllerKind[];
  /** Null while nothing has been picked yet (the landing page starts that way). */
  value: ControllerKind | null;
  onChange: (next: ControllerKind) => void;
  unavailable?: readonly ControllerKind[];
}) {
  if (options.length < 2) return null;
  const t = droneText(locale);
  const st = choiceStyles(onDark);
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label ?? t.choice.howFly}</p>
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
              className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-3 text-center ${off ? st.unavailable : value === o ? st.selected : st.idle}`}
            >
              <span className="text-sm font-semibold leading-tight">{o === "NONE" ? t.common.phoneOnly : (controllerProfileFor(model, o)?.shortName ?? CONTROLLER_PROFILES[o].shortName)}</span>
              <span className={`text-xs tabular-nums ${off ? "" : value === o ? "opacity-80" : st.sub}`}>{t.common.perHour(formatMyr(extraPerHour(model, o)))}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { PendingLink } from "@/components/PendingLink";
import { packageQuery } from "@/lib/droneRental/packagePreset";
import {
  DRONE_MODEL_PROFILES,
  ENABLED_DRONE_MODELS,
  comboKey,
  controllerLabel,
  depositMyrFor,
  hourlyRateFor,
  rentalFeeMyr,
  type ControllerKind,
  type DroneModel,
} from "@/lib/droneRental/pricingRules";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";
import type { CompareTables } from "@/lib/droneRental/compareTables";
import { ComboCard, TotalSummary } from "./ComboCard";
import { ControllerChoice } from "./ControllerChoice";
import { DroneChoice } from "./DroneChoice";
import { BatteryChoice, DurationChoice } from "./PackageChoices";
import { useEffect } from "react";
import { trackStep } from "@/components/FunnelBeacon";
import { usePackage } from "./PackageContext";

export type PackagePickerText = { hint: string; cta: string; next: string };

/**
 * The landing page's "Check the price": the same choices as the first step of the booking page (drone, how you fly it, how long, batteries),
 * asked one after the other, nothing chosen to begin with (the choices under the comparison tables on the page fill in the same package). Once all four are chosen the price shows, with a button to choose the
 * location. The package then travels in the address to the shop list and on to the booking page, which opens at the times.
 */
export function PackagePicker({ locale, pictures, text, tables }: { locale: Locale; pictures: Record<string, string>; text: PackagePickerText; tables: CompareTables }) {
  const t = droneText(locale);
  const { model, controller, batteries, hours, setModel, setController, setBatteries, setHours, unavailableModels, unavailableControllers } = usePackage();

  // Counted once the whole package is chosen and the price shows.
  const complete = model !== null && controller !== null && batteries !== null && hours !== null;
  useEffect(() => {
    if (complete) trackStep("PRICE");
  }, [complete]);

  const profile = model ? DRONE_MODEL_PROFILES[model] : null;
  const controllerName = (m: DroneModel, kind: ControllerKind) => (kind === "NONE" ? t.common.phoneOnly : controllerLabel(m, kind));

  return (
    <div className="mt-8 grid gap-8 md:grid-cols-2 md:items-start">
      <div className="space-y-6">
        <DroneChoice onDark locale={locale} models={ENABLED_DRONE_MODELS} value={model} onChange={setModel} compare={tables.drone} unavailable={unavailableModels} unavailableLabel={t.common.notAvailable} />
        {profile && model && <ControllerChoice onDark locale={locale} model={model} options={profile.controllerOptions} value={controller} onChange={setController} compare={tables.fly} unavailable={unavailableControllers} unavailableLabel={t.common.notAvailable} />}
        {model && controller && <DurationChoice onDark locale={locale} value={hours} hourly={hourlyRateFor(model, controller)} onChange={setHours} />}
        {model && controller && hours && <BatteryChoice onDark locale={locale} model={model} value={batteries} onChange={setBatteries} />}
      </div>

      <div className="space-y-5 rounded-2xl border border-slate-600 bg-slate-900 p-5 md:sticky md:top-6">
        {model && controller && batteries && hours ? (
          <>
            <p className="text-sm text-slate-300">
              {[DRONE_MODEL_PROFILES[model].shortName, controllerName(model, controller), t.common.batteries(batteries), t.common.hours(hours)].join(" · ")}
            </p>
            <ComboCard
              onDark
              locale={locale}
              pictureUrl={pictures[comboKey(model, controller, batteries)]}
              depositMyr={depositMyrFor(model, controller)}
              alt={`${DRONE_MODEL_PROFILES[model].shortName}, ${controllerName(model, controller)}, ${t.common.batteries(batteries)}`}
            />
            <TotalSummary onDark locale={locale} totalMyr={rentalFeeMyr(hours * 60, batteries, model, controller)} depositMyr={depositMyrFor(model, controller)} />
            <PendingLink
              href={`/rent?${packageQuery({ model, controller, batteries, hours })}`}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              {text.cta}
            </PendingLink>
            <p className="text-center text-xs text-slate-400">{text.next}</p>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-slate-300">{text.hint}</p>
        )}
      </div>
    </div>
  );
}

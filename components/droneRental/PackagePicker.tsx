"use client";

import { useState } from "react";
import Link from "next/link";
import { packageQuery } from "@/lib/droneRental/packagePreset";
import {
  DRONE_MODEL_PROFILES,
  ENABLED_DRONE_MODELS,
  comboKey,
  controllerLabel,
  depositMyrFor,
  hourlyRateFor,
  rentalFeeMyr,
  type BatteryCount,
  type ControllerKind,
  type DroneModel,
} from "@/lib/droneRental/pricingRules";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";
import { ComboCard, TotalSummary } from "./ComboCard";
import { ControllerChoice } from "./ControllerChoice";
import { DroneChoice } from "./DroneChoice";
import { BatteryChoice, DurationChoice } from "./PackageChoices";

export type PackagePickerText = { hint: string; cta: string; next: string };

/**
 * The landing page's "Check the price": the same choices as the first step of the booking page (drone, how you fly it, batteries, how
 * long), asked one after the other, nothing chosen to begin with. Once all four are chosen the price shows, with a button to choose the
 * location. The package then travels in the address to the shop list and on to the booking page, which opens at the times.
 */
export function PackagePicker({ locale, pictures, text }: { locale: Locale; pictures: Record<string, string>; text: PackagePickerText }) {
  const t = droneText(locale);
  const [model, setModel] = useState<DroneModel | null>(null);
  const [controller, setController] = useState<ControllerKind | null>(null);
  const [batteries, setBatteries] = useState<BatteryCount | null>(null);
  const [hours, setHours] = useState<number | null>(null);

  const profile = model ? DRONE_MODEL_PROFILES[model] : null;
  const controllerName = (m: DroneModel, kind: ControllerKind) => (kind === "NONE" ? t.common.phoneOnly : controllerLabel(m, kind));

  return (
    <div className="mt-8 grid gap-8 md:grid-cols-2 md:items-start">
      <div className="space-y-6">
        <DroneChoice onDark locale={locale} models={ENABLED_DRONE_MODELS} value={model} onChange={setModel} />
        {profile && model && <ControllerChoice onDark locale={locale} model={model} options={profile.controllerOptions} value={controller} onChange={setController} />}
        {model && controller && <BatteryChoice onDark locale={locale} model={model} value={batteries} onChange={setBatteries} />}
        {model && controller && batteries && <DurationChoice onDark locale={locale} value={hours} hourly={hourlyRateFor(model, controller)} onChange={setHours} />}
      </div>

      <div className="space-y-5 rounded-2xl border border-zinc-800 bg-black p-5 md:sticky md:top-6">
        {model && controller && batteries && hours ? (
          <>
            <p className="text-sm text-zinc-400">
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
            <Link
              href={`/rent?${packageQuery({ model, controller, batteries, hours })}`}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              {text.cta}
            </Link>
            <p className="text-center text-xs text-zinc-500">{text.next}</p>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-zinc-500">{text.hint}</p>
        )}
      </div>
    </div>
  );
}

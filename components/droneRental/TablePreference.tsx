"use client";

import { DRONE_MODEL_PROFILES, ENABLED_DRONE_MODELS } from "@/lib/droneRental/pricingRules";
import type { Locale } from "@/lib/i18n/locale";
import { ControllerChoice } from "./ControllerChoice";
import { DroneChoice } from "./DroneChoice";
import { usePackage } from "./PackageContext";

export type TablePreferenceText = { label: string; added: string; see: string };

/**
 * "Which do you prefer?" under a comparison table on the landing page: the drone under the Neo / Neo 2 table, the way of flying under the
 * phone / RC-N3 / goggles table. The choice goes into the package in "Check the price" above, and a link takes them there.
 */
export function TablePreference({ kind, locale, text }: { kind: "drone" | "fly"; locale: Locale; text: TablePreferenceText }) {
  const pkg = usePackage();
  const chosen = kind === "drone" ? pkg.model : pkg.controller;
  return (
    <div className="mt-6 max-w-md rounded-2xl border border-slate-600 bg-slate-800 p-5">
      {kind === "drone" ? (
        <DroneChoice onDark locale={locale} label={text.label} models={ENABLED_DRONE_MODELS} value={pkg.model} onChange={pkg.setModel} />
      ) : (
        <ControllerChoice
          onDark
          locale={locale}
          label={text.label}
          model={pkg.model ?? "NEO2"}
          options={DRONE_MODEL_PROFILES[pkg.model ?? "NEO2"].controllerOptions}
          value={pkg.controller}
          onChange={pkg.setController}
        />
      )}
      {chosen && (
        <p className="mt-3 text-sm text-slate-300">
          {text.added}{" "}
          <a href="#price" className="font-medium text-white underline underline-offset-4 hover:text-zinc-200">
            {text.see}
          </a>
        </p>
      )}
    </div>
  );
}

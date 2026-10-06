"use client";

import { CONTROLLER_PROFILES, controllerProfileFor, formatMyr, hourlyRateFor, type ControllerKind } from "@/lib/droneRental/pricingRules";

const selectedClass = "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black";
const idleClass = "border-zinc-300 dark:border-zinc-700";

const NOTES: Record<ControllerKind, string> = {
  NONE: "Phone only",
  RC_N3: "Controller + phone",
  GOGGLES_N3: "Goggles + motion controller",
};

/** What a customer needs to know about the way they picked, shown under the choice. */
export function controllerHelp(controller: ControllerKind): string | null {
  if (controller === "NONE") return "You fly it from your own phone with the DJI Fly app, so bring a phone with it installed.";
  if (controller === "RC_N3") return "The RC-N3 controller clips onto your own phone, which shows the camera view. Install the DJI Fly app on it.";
  return "Wear the Goggles N3 for a first-person view and fly with the Motion 3 controller in your hand. No phone needed.";
}

/** The choice between flying from your phone, the RC-N3 controller or the goggles set, with what each costs per hour for this drone. */
export function ControllerChoice({
  model,
  options,
  value,
  onChange,
}: {
  model: string;
  options: readonly ControllerKind[];
  value: ControllerKind;
  onChange: (next: ControllerKind) => void;
}) {
  // A shop with no controllers only rents phone-only: nothing to choose, but they should still know what they need.
  if (options.length < 2) return value === "NONE" ? <p className="text-xs text-zinc-500">{controllerHelp("NONE")}</p> : null;
  return (
    <div>
      <p className="mb-2 text-sm font-medium">How will you fly it?</p>
      <div className={`grid gap-2 ${options.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            aria-pressed={value === o}
            className={`rounded-xl border px-2 py-3 text-center ${value === o ? selectedClass : idleClass}`}
          >
            <span className="block text-sm font-semibold">{o === "NONE" ? "Phone only" : (controllerProfileFor(model, o)?.shortName ?? CONTROLLER_PROFILES[o].shortName)}</span>
            <span className={`block text-xs ${value === o ? "opacity-80" : "text-zinc-500"}`}>{formatMyr(hourlyRateFor(model, o))} per hour</span>
            <span className={`block text-[11px] leading-tight ${value === o ? "opacity-70" : "text-zinc-400"}`}>{NOTES[o]}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500">{controllerHelp(value)}</p>
    </div>
  );
}

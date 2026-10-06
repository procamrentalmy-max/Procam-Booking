"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { ControllerChoice } from "@/components/droneRental/ControllerChoice";
import { ComboCard, TotalSummary } from "@/components/droneRental/ComboCard";
import {
  BATTERY_OPTIONS,
  DEFAULT_BATTERIES,
  DRONE_MODEL_PROFILES,
  ENABLED_DRONE_MODELS,
  comboKey,
  controllerLabel,
  depositMyrFor,
  formatMyr,
  hourlyRateFor,
  rentalFeeMyr,
  type BatteryCount,
  type ControllerKind,
  type DroneModel,
} from "@/lib/droneRental/pricingRules";
import type { WalkInOptions } from "@/lib/droneRental/walkInRequests";
import { submitWalkInOrderAction } from "./actions";

const selectedClass = "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black";
const idleClass = "border-zinc-300 dark:border-zinc-700";

export function WalkInOrderForm({ code, options, pictures }: { code: string; options: WalkInOptions; pictures: Record<string, string> }) {
  const router = useRouter();
  const models = ENABLED_DRONE_MODELS.filter((m) => Object.keys(options[m] ?? {}).length > 0);
  const [model, setModel] = useState<DroneModel>(models.includes("NEO2") ? "NEO2" : models[0]);
  const profile = DRONE_MODEL_PROFILES[model];
  // How they can fly this drone right now: only the ways that still have a length on offer (a controller out with someone else drops off).
  const controllerOptions = profile.controllerOptions.filter((o) => (options[model]?.[o] ?? []).length > 0);
  const [pickedController, setPickedController] = useState<ControllerKind>("NONE");
  const controller = controllerOptions.includes(pickedController) ? pickedController : controllerOptions[0];
  const durationsMinutes = options[model]?.[controller] ?? [];
  const [chosenMinutes, setChosenMinutes] = useState(durationsMinutes[0] ?? 60);
  // Another model may offer different lengths; fall back to its first if the current pick isn't on offer.
  const durationMinutes = durationsMinutes.includes(chosenMinutes) ? chosenMinutes : (durationsMinutes[0] ?? 60);
  const setDurationMinutes = setChosenMinutes;
  const [batteries, setBatteries] = useState<BatteryCount>(DEFAULT_BATTERIES);
  const hourly = hourlyRateFor(model, controller);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    const result = await submitWalkInOrderAction({ code, durationMinutes, batteries, model, controller, name, phone, email });
    if (result.ok) {
      router.push(`/rent/w/${result.token}`);
      return;
    }
    setError(result.message);
    setLoading(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-6"
    >
      {models.length > 1 && (
        <div>
          <p className="mb-2 text-sm font-medium">Which drone?</p>
          <div className="grid grid-cols-2 gap-2">
            {models.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModel(m)}
                aria-pressed={model === m}
                className={`rounded-xl border px-3 py-3 text-center ${model === m ? selectedClass : idleClass}`}
              >
                <span className="block text-sm font-semibold">{DRONE_MODEL_PROFILES[m].shortName}</span>
                <span className={`block text-xs ${model === m ? "opacity-80" : "text-zinc-500"}`}>{formatMyr(DRONE_MODEL_PROFILES[m].hourlyRateMyr)} per hour</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <ControllerChoice model={model} options={controllerOptions} value={controller} onChange={setPickedController} />

      <div>
        <p className="mb-2 text-sm font-medium">How long do you need it?</p>
        <div className={`grid gap-2 ${durationsMinutes.length > 3 ? "grid-cols-4" : "grid-cols-3"}`}>
          {durationsMinutes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setDurationMinutes(m)}
              aria-pressed={durationMinutes === m}
              className={`rounded-xl border py-3 text-center ${durationMinutes === m ? selectedClass : idleClass}`}
            >
              <span className="block text-sm font-semibold">{m / 60}h</span>
              <span className={`block text-xs ${durationMinutes === m ? "opacity-80" : "text-zinc-500"}`}>{formatMyr((m / 60) * hourly)}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">How many batteries?</p>
        <div className="grid grid-cols-2 gap-2">
          {BATTERY_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setBatteries(n)}
              aria-pressed={batteries === n}
              className={`rounded-xl border px-3 py-3 text-center ${batteries === n ? selectedClass : idleClass}`}
            >
              <span className="block text-sm font-semibold">
                {n} {n === 1 ? "battery" : "batteries"} · {formatMyr(profile.batteryFeeMyr[n])}
              </span>
              {profile.flightMinutes && (
                <span className={`block text-xs ${batteries === n ? "opacity-80" : "text-zinc-500"}`}>about {profile.flightMinutes[n]} min of flying</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <ComboCard
        pictureUrl={pictures[comboKey(model, controller, batteries)]}
        depositMyr={depositMyrFor(model, controller)}
        alt={`${profile.shortName}, ${controllerLabel(model, controller)}, ${batteries} ${batteries === 1 ? "battery" : "batteries"}`}
      />
      <TotalSummary totalMyr={rentalFeeMyr(durationMinutes, batteries, model, controller)} depositMyr={depositMyrFor(model, controller)} />

      <div className="space-y-3">
        <p className="text-sm font-medium">Your details</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="name" required className={`w-full ${inputClass} py-3 text-base`} />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          required
          className={`w-full ${inputClass} py-3 text-base`}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          autoComplete="email"
          required
          className={`w-full ${inputClass} py-3 text-base`}
        />
      </div>

      {error && (
        <p role="alert" className="text-center text-sm text-red-600">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading || !name || !phone || !email} className={`w-full ${primaryButtonClass} h-12 rounded-full text-base disabled:opacity-50`}>
        {loading ? "Sending…" : "Send my order to the shop"}
      </button>
      <p className="text-center text-xs text-zinc-400">The staff confirm your order, then you pay on this phone.</p>
    </form>
  );
}

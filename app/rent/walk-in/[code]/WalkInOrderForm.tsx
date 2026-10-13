"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { ControllerChoice } from "@/components/droneRental/ControllerChoice";
import { ComboCard, TotalSummary } from "@/components/droneRental/ComboCard";
import { DroneChoice } from "@/components/droneRental/DroneChoice";
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
import { useDroneKyc } from "@/components/droneRental/useDroneKyc";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";

const selectedClass = "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black";
const idleClass = "border-zinc-300 dark:border-zinc-700";

export function WalkInOrderForm({ code, options, pictures, adminCanSkip = false, locale = "en" }: { code: string; options: WalkInOptions; pictures: Record<string, string>; adminCanSkip?: boolean; locale?: Locale }) {
  const t = droneText(locale);
  const router = useRouter();
  // Every drone is listed; only those with a length on offer right now can be picked, the rest are greyed out.
  const models = ENABLED_DRONE_MODELS;
  const pickableModels = models.filter((m) => Object.keys(options[m] ?? {}).length > 0);
  const [model, setModel] = useState<DroneModel>(pickableModels.includes("NEO2") ? "NEO2" : pickableModels[0]);
  const profile = DRONE_MODEL_PROFILES[model];
  // Every way of flying is listed; only those with a length on offer (a controller the shop has none of, or has out, has none) can be picked.
  const controllerOptions = profile.controllerOptions;
  const selectableControllers = controllerOptions.filter((o) => (options[model]?.[o] ?? []).length > 0);
  const [pickedController, setPickedController] = useState<ControllerKind>("NONE");
  const controller = selectableControllers.includes(pickedController) ? pickedController : selectableControllers[0];
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

  const { verifyThen, panel: idCheckPanel, kycBusy, kycMessage } = useDroneKyc({ adminCanSkip, locale });

  /** The first thing sending the order does: the ID check. The order is sent once it has passed. */
  function submit() {
    setError(null);
    void verifyThen({ name, phone, email }, sendOrder);
  }

  async function sendOrder(verificationId: string) {
    setLoading(true);
    setError(null);
    const result = await submitWalkInOrderAction({ code, durationMinutes, batteries, model, controller, name, phone, email, verificationId });
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
      <DroneChoice locale={locale} models={models} value={model} onChange={setModel} unavailable={models.filter((m) => !pickableModels.includes(m))} />

      <ControllerChoice
        locale={locale}
        model={model}
        options={controllerOptions}
        value={controller}
        onChange={setPickedController}
        unavailable={controllerOptions.filter((o) => !selectableControllers.includes(o))}
      />

      <div>
        <p className="mb-2 text-sm font-medium">{t.wizard.howLong}</p>
        <div className={`grid gap-2 ${durationsMinutes.length > 3 ? "grid-cols-4" : "grid-cols-3"}`}>
          {durationsMinutes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setDurationMinutes(m)}
              aria-pressed={durationMinutes === m}
              className={`rounded-xl border py-3 text-center ${durationMinutes === m ? selectedClass : idleClass}`}
            >
              <span className="block text-sm font-semibold">{t.common.shortHours(m / 60)}</span>
              <span className={`block text-xs ${durationMinutes === m ? "opacity-80" : "text-zinc-500"}`}>{formatMyr((m / 60) * hourly)}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t.wizard.howMany}</p>
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
                {t.common.batteries(n)} · {formatMyr(profile.batteryFeeMyr[n])}
              </span>
              {profile.flightMinutes && (
                <span className={`block text-xs ${batteries === n ? "opacity-80" : "text-zinc-500"}`}>{t.wizard.flightNote(profile.flightMinutes[n])}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <ComboCard
        locale={locale}
        pictureUrl={pictures[comboKey(model, controller, batteries)]}
        depositMyr={depositMyrFor(model, controller)}
        alt={`${profile.shortName}, ${controller === "NONE" ? t.common.phoneOnly : controllerLabel(model, controller)}, ${t.common.batteries(batteries)}`}
      />
      <TotalSummary locale={locale} totalMyr={rentalFeeMyr(durationMinutes, batteries, model, controller)} depositMyr={depositMyrFor(model, controller)} />

      <div className="space-y-3">
        <p className="text-sm font-medium">{t.walkIn.yourDetails}</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.common.fullName} autoComplete="name" required className={`w-full ${inputClass} py-3 text-base`} />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t.common.phone}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          required
          className={`w-full ${inputClass} py-3 text-base`}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.common.email}
          type="email"
          autoComplete="email"
          required
          className={`w-full ${inputClass} py-3 text-base`}
        />
      </div>

      {(error ?? kycMessage) && (
        <p role="alert" className="text-center text-sm text-red-600">
          {error ?? kycMessage}
        </p>
      )}
      {idCheckPanel ?? (
        <button type="submit" disabled={loading || kycBusy || !name || !phone || !email} className={`w-full ${primaryButtonClass} h-12 rounded-full text-base disabled:opacity-50`}>
          {loading || kycBusy ? t.walkIn.sending : t.walkIn.send}
        </button>
      )}
      <p className="text-center text-xs text-zinc-400">{t.walkIn.note}</p>
    </form>
  );
}

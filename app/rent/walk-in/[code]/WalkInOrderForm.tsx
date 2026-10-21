"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, pressableClass, primaryButtonClass } from "@/components/formStyles";
import { Spinner } from "@/components/Spinner";
import { ControllerChoice } from "@/components/droneRental/ControllerChoice";
import { WhatsAppNumberField } from "@/components/droneRental/WhatsAppNumberField";
import type { CompareTables } from "@/lib/droneRental/compareTables";
import { ComboCard, TotalSummary } from "@/components/droneRental/ComboCard";
import { DroneChoice } from "@/components/droneRental/DroneChoice";
import {
  BATTERY_OPTIONS,
  DEFAULT_BATTERIES,
  DRONE_MODEL_PROFILES,
  ENABLED_DRONE_MODELS,
  DAY_MINUTES,
  MULTI_DAY_DISCOUNT_PERCENT,
  comboKey,
  controllerLabel,
  dailyBreakdown,
  dailyFeeMyr,
  dailyRateFor,
  depositMyrFor,
  formatMyr,
  hourlyRateFor,
  isDailyMinutes,
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
const idleClass = pressableClass;

export function WalkInOrderForm({ code, options, pictures, adminCanSkip = false, locale = "en", tables }: { code: string; options: WalkInOptions; pictures: Record<string, string>; adminCanSkip?: boolean; locale?: Locale; /** The comparison tables behind the Compare buttons. */ tables?: CompareTables }) {
  const t = droneText(locale);
  const router = useRouter();
  // Every drone is listed; only those with a length on offer right now can be picked, the rest are greyed out.
  const models = ENABLED_DRONE_MODELS;
  const pickableModels = models.filter((m) => Object.keys(options[m] ?? {}).length > 0);
  const [model, setModel] = useState<DroneModel>(pickableModels.includes("NEO2") ? "NEO2" : pickableModels[0]);
  const profile = DRONE_MODEL_PROFILES[model];
  // Every way of flying is listed; only those with a length on offer (a controller the shop has none of, or has out, has none) can be picked.
  const controllerOptions = profile.controllerOptions;
  const lengthsOf = (o: ControllerKind) => options[model]?.[o] ?? [];
  // By the hour or by the day: the days toggle is there only when some way of flying has a length of days on offer right now.
  const canDaily = controllerOptions.some((o) => lengthsOf(o).some(isDailyMinutes));
  const [wantsDays, setWantsDays] = useState(false);
  const byDay = wantsDays && canDaily;
  const ofThisKind = (minutes: number) => isDailyMinutes(minutes) === byDay;
  const selectableControllers = controllerOptions.filter((o) => lengthsOf(o).some(ofThisKind));
  const [pickedController, setPickedController] = useState<ControllerKind>("NONE");
  const controller = selectableControllers.includes(pickedController) ? pickedController : selectableControllers[0];
  const durationsMinutes = lengthsOf(controller).filter(ofThisKind);
  const [chosenMinutes, setChosenMinutes] = useState(durationsMinutes[0] ?? 60);
  // Another model may offer different lengths; fall back to its first if the current pick isn't on offer.
  const durationMinutes = durationsMinutes.includes(chosenMinutes) ? chosenMinutes : (durationsMinutes[0] ?? 60);
  const setDurationMinutes = setChosenMinutes;
  const [batteries, setBatteries] = useState<BatteryCount>(DEFAULT_BATTERIES);
  const hourly = hourlyRateFor(model, controller);
  const perDay = dailyRateFor(model, controller);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
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
    const result = await submitWalkInOrderAction({ code, durationMinutes, batteries: byDay ? DEFAULT_BATTERIES : batteries, model, controller, name, phone, email, verificationId, whatsappNumber });
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
      <DroneChoice locale={locale} models={models} value={model} onChange={setModel} unavailable={models.filter((m) => !pickableModels.includes(m))} compare={tables?.drone} />

      <ControllerChoice
        locale={locale}
        model={model}
        options={controllerOptions}
        value={controller}
        onChange={setPickedController}
        unavailable={controllerOptions.filter((o) => !selectableControllers.includes(o))}
        compare={tables?.fly}
        daily={byDay}
      />

      <div>
        <p className="mb-2 text-sm font-medium">{byDay ? t.wizard.howManyDays : t.wizard.howLong}</p>
        {canDaily && (
          <div className="mb-2 grid grid-cols-2 gap-2" role="group" aria-label={t.wizard.howLong}>
            {([false, true] as const).map((days) => (
              <button key={String(days)} type="button" onClick={() => setWantsDays(days)} aria-pressed={byDay === days} className={`rounded-xl border py-2.5 text-center text-sm font-semibold ${byDay === days ? selectedClass : idleClass}`}>
                {days ? t.wizard.byDay : t.wizard.byHour}
              </button>
            ))}
          </div>
        )}
        <div className={`grid gap-2 ${durationsMinutes.length > 3 ? "grid-cols-4" : "grid-cols-3"}`}>
          {durationsMinutes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setDurationMinutes(m)}
              aria-pressed={durationMinutes === m}
              className={`rounded-xl border py-3 text-center ${durationMinutes === m ? selectedClass : idleClass}`}
            >
              <span className="block text-sm font-semibold">{byDay ? t.common.days(m / DAY_MINUTES) : t.common.shortHours(m / 60)}</span>
              <span className={`block text-xs ${durationMinutes === m ? "opacity-80" : "text-zinc-500"}`}>{byDay ? formatMyr(dailyFeeMyr(m / DAY_MINUTES, model, controller) ?? 0) : formatMyr((m / 60) * hourly)}</span>
              {byDay && (
                <span className={`block text-xs ${durationMinutes === m ? "opacity-80" : "text-zinc-500"}`}>
                  {m === DAY_MINUTES && perDay !== null ? t.wizard.perDay(formatMyr(perDay)) : t.wizard.savePct(MULTI_DAY_DISCOUNT_PERCENT * (m / DAY_MINUTES - 1))}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {byDay && (
        <p className="text-xs leading-snug text-zinc-500">
          {t.wizard.dailyIncludes} · {t.wizard.dailyDiscount}. {t.wizard.dailyReturn}
        </p>
      )}

      {!byDay && (
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
      )}

      <ComboCard
        locale={locale}
        pictureUrl={pictures[comboKey(model, controller, batteries)]}
        depositMyr={depositMyrFor(model, controller)}
        alt={`${profile.shortName}, ${controller === "NONE" ? t.common.phoneOnly : controllerLabel(model, controller)}${byDay ? "" : `, ${t.common.batteries(batteries)}`}`}
      />
      <TotalSummary locale={locale} breakdown={dailyBreakdown(durationMinutes, model, controller)} totalMyr={rentalFeeMyr(durationMinutes, batteries, model, controller)} depositMyr={depositMyrFor(model, controller)} />

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
        <WhatsAppNumberField value={whatsappNumber} onChange={setWhatsappNumber} locale={locale} />
      </div>

      {(error ?? kycMessage) && (
        <p role="alert" className="text-center text-sm text-red-600">
          {error ?? kycMessage}
        </p>
      )}
      {idCheckPanel ?? (
        <button type="submit" disabled={loading || kycBusy || !name || !phone || !email} className={`flex w-full items-center justify-center gap-2 ${primaryButtonClass} h-12 rounded-full text-base disabled:opacity-50`}>
          {(loading || kycBusy) && <Spinner />}
          {loading || kycBusy ? t.walkIn.sending : t.walkIn.send}
        </button>
      )}
      <p className="text-center text-xs text-zinc-400">{t.walkIn.note}</p>
    </form>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { inputClass, pressableClass, primaryButtonClass } from "@/components/formStyles";
import { formatMalaysiaTime, type Locale } from "@/lib/i18n/locale";
import { dayLabelFor, droneText } from "@/lib/i18n/drone";
import { AgreeLine } from "@/components/droneRental/AgreeLine";
import { FaqLink } from "@/components/droneRental/FaqLink";
import { ControllerChoice } from "@/components/droneRental/ControllerChoice";
import { ComboCard, TotalSummary } from "@/components/droneRental/ComboCard";
import type { PackagePreset } from "@/lib/droneRental/packagePreset";
import type { CompareTables } from "@/lib/droneRental/compareTables";
import { DroneChoice } from "@/components/droneRental/DroneChoice";
import { BatteryChoice, DurationChoice } from "@/components/droneRental/PackageChoices";
import { SlotTakenDialog } from "@/components/droneRental/SlotTakenDialog";
import {
  DEFAULT_BATTERIES,
  DRONE_MODEL_PROFILES,
  type BatteryCount,
  type ControllerKind,
  type DroneModel,
  comboKey,
  controllerLabel,
  depositMyrFor,
  effectiveController,
  formatMyr,
  hourlyRateFor,
  includesController,
  rentalFeeMyr,
} from "@/lib/droneRental/pricingRules";
import { formatSlotTime, generateDaySlots } from "@/lib/droneRental/hours";
import { getUnavailableDroneStartsAction, createDroneBookingAction } from "@/app/rent/[shopId]/actions";
import { useDroneKyc } from "@/components/droneRental/useDroneKyc";

const DAYS_AHEAD = 7;

/**
 * What the customer typed and picked is kept in this browser tab's own memory (sessionStorage), never sent to the server, so that if
 * the last drone for their time is taken by someone who paid first they can choose another time without filling everything in
 * again. It is read once when they come back and then deleted, and it disappears with the tab: close or leave the page and it's gone.
 */
const DRAFT_KEY = "procam-booking-draft";

type Step = "duration" | "slot" | "contact";

const selectedClass = "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black";
const idleClass = pressableClass;

function StepHeader({ step, onBack, locale, shopsHref = "/rent" }: { step: Step; onBack?: () => void; locale: Locale; /** Where "Other shops" goes: the shop list, keeping the package picked on the landing page. */ shopsHref?: string }) {
  const t = droneText(locale).common;
  const n = step === "duration" ? 1 : step === "slot" ? 2 : 3;
  return (
    <div className="flex h-6 items-center justify-between text-xs text-zinc-500">
      {onBack ? (
        <button type="button" onClick={onBack} className="-ml-1 px-1 py-1 text-sm underline underline-offset-2">
          {t.back}
        </button>
      ) : (
        <Link href={shopsHref} className="-ml-1 px-1 py-1 text-sm underline underline-offset-2">
          {t.otherShops}
        </Link>
      )}
      <span>{t.step(n)}</span>
    </div>
  );
}

/**
 * Every drone and every way of flying is listed. `availableModels` and `controllers` are what this shop actually has to rent
 * out (drones that aren't retired or lost, the RC-N3, the goggles set); anything the shop has none of is greyed out and can't be
 * picked. Phone only is always possible. `pictures` are the admin's pictures for each combination, by comboKey.
 */
export function DroneBookingWizard({
  shopId,
  models,
  availableModels,
  controllers,
  pictures,
  retry = false,
  adminCanSkip = false,
  locale = "en",
  preset = null,
  shopsHref = "/rent",
  tables,
}: {
  shopId: string;
  models: DroneModel[];
  availableModels: DroneModel[];
  controllers: ControllerKind[];
  pictures: Record<string, string>;
  /** True when the customer is sent back here because the time they paid for was taken: restore what they had and go to the times. */
  retry?: boolean;
  /** A signed-in admin is testing the live site: show the skip-ID-check button. */
  adminCanSkip?: boolean;
  /** The visitor's language. */
  locale?: Locale;
  /** A package picked on the landing page. When this shop can supply all of it the booking opens at the times; otherwise at the package step with a note. */
  preset?: PackagePreset | null;
  /** The shop list address, with the package carried along, for the "Other shops" link. */
  shopsHref?: string;
  /** The comparison tables behind the Compare buttons beside the drone and the way-to-fly choices. */
  tables?: CompareTables;
}) {
  const t = droneText(locale);
  const router = useRouter();
  // The package from the landing page: used as it is when this shop has the drone and the controller, and ignored where it does not.
  const presetModel = preset && availableModels.includes(preset.model) ? preset.model : null;
  const presetController = preset && presetModel && (preset.controller === "NONE" || controllers.includes(preset.controller)) ? preset.controller : null;
  const presetFits = !!preset && presetModel === preset.model && presetController === preset.controller;
  const [presetNote, setPresetNote] = useState(!!preset && !presetFits);
  const [step, setStep] = useState<Step>(presetFits ? "slot" : "duration");
  const [model, setModel] = useState<DroneModel>(presetModel ?? (availableModels.includes("NEO2") ? "NEO2" : (availableModels[0] ?? models[0])));
  const [durationHours, setDurationHours] = useState(preset?.hours ?? 1);
  const [batteries, setBatteries] = useState<BatteryCount>(preset?.batteries ?? DEFAULT_BATTERIES);
  // How they will fly it: their own phone, or a controller the shop has. Only choices this shop can actually offer are shown.
  const [pickedController, setPickedController] = useState<ControllerKind>(presetController ?? "NONE");
  const [now, setNow] = useState(() => new Date());
  const [dayOffset, setDayOffset] = useState(0);
  const [slots, setSlots] = useState<Date[]>([]);
  const [unavailable, setUnavailable] = useState<Set<number> | null>(null);
  // Set when some of the day's times are too windy for this drone (the forecast is over its limit).
  const [windNote, setWindNote] = useState<{ limit: number; worst: number } | null>(null);
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slotTaken, setSlotTaken] = useState(false);

  const durationMinutes = durationHours * 60;
  const profile = DRONE_MODEL_PROFILES[model];
  // Every way of flying is listed; those the shop has none of are greyed out and never chosen.
  const controllerOptions = profile.controllerOptions;
  const selectableControllers = controllerOptions.filter((o) => o === "NONE" || controllers.includes(o));
  const asked = effectiveController(model, pickedController);
  const controller = selectableControllers.includes(asked) ? asked : selectableControllers[0];
  const withController = includesController(model, controller);
  const hourly = hourlyRateFor(model, controller);
  const deposit = depositMyrFor(model, controller);
  const rentalFee = rentalFeeMyr(durationMinutes, batteries, model, controller);
  /** "Phone only" in the visitor's language, or the controller's own name (a product name, never translated). */
  const controllerName = (kind: ControllerKind) => (kind === "NONE" ? t.common.phoneOnly : controllerLabel(model, kind));

  // (Re)draw the grid for the chosen day and duration, then grey out what's taken. The grid itself is
  // worked out in Malaysia time (lib/droneRental/hours) so it's right whatever timezone the phone is in;
  // the server stays the authority on what's actually bookable.
  useEffect(() => {
    if (step !== "slot") return;
    const current = new Date();
    const candidates = generateDaySlots(current, dayOffset, durationMinutes);
    setNow(current);
    setSlots(candidates);
    setSelectedStart(null);
    if (candidates.length === 0) {
      setUnavailable(new Set());
      return;
    }
    setUnavailable(null);
    setWindNote(null);
    let cancelled = false;
    getUnavailableDroneStartsAction({ shopId, model, controller, durationMinutes, starts: candidates.map((d) => d.toISOString()) })
      .then((result) => {
        if (cancelled) return;
        const bad = new Set<number>();
        result.unavailable.forEach((isBad, i) => {
          if (isBad) bad.add(i);
        });
        setUnavailable(bad);
        setWindNote(result.windy.some(Boolean) && result.windLimitMps !== null && result.worstWindMps !== null ? { limit: result.windLimitMps, worst: result.worstWindMps } : null);
      })
      .catch(() => {
        if (!cancelled) setUnavailable(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [step, shopId, model, controller, durationMinutes, dayOffset]);

  // Coming back after losing the last drone: put their choices and details back, ready to pick another time.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      sessionStorage.removeItem(DRAFT_KEY);
      if (!retry || !raw) return;
      const d = JSON.parse(raw) as Partial<{ shopId: string; model: DroneModel; controller: ControllerKind; durationHours: number; batteries: BatteryCount; dayOffset: number; name: string; phone: string; email: string }>;
      if (d.shopId !== shopId) return;
      if (d.model && models.includes(d.model)) setModel(d.model);
      if (d.controller) setPickedController(d.controller);
      if (typeof d.durationHours === "number") setDurationHours(d.durationHours);
      if (d.batteries === 1 || d.batteries === 2) setBatteries(d.batteries);
      if (typeof d.dayOffset === "number") setDayOffset(d.dayOffset);
      setName(d.name ?? "");
      setPhone(d.phone ?? "");
      setEmail(d.email ?? "");
      setStep("slot");
    } catch {
      // No tab memory (a private window, say): they just start again.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function rememberDraft() {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ shopId, model, controller, durationHours, batteries, dayOffset, name, phone, email }));
    } catch {
      // Nothing to remember it in: they would start again, nothing worse.
    }
  }

  const { verifyThen, panel: idCheckPanel, kycBusy, kycMessage } = useDroneKyc({ adminCanSkip, locale });

  /** The first thing "Book and pay" does: the ID check. The booking itself is made once it has passed. */
  function submit() {
    if (!selectedStart) return;
    setError(null);
    void verifyThen({ name, phone, email }, placeBooking);
  }

  async function placeBooking(verificationId: string) {
    if (!selectedStart) return;
    setLoading(true);
    setError(null);
    try {
      const result = await createDroneBookingAction({
        shopId,
        model,
        durationMinutes,
        startTime: selectedStart.toISOString(),
        batteries,
        controller,
        name,
        phone,
        email,
        verificationId,
      });
      if ("error" in result) {
        setError(result.error);
        setLoading(false);
        return;
      }
      // Someone else paid for the last drone first: the popup, with everything still filled in.
      if ("slotTaken" in result) {
        setSlotTaken(true);
        setLoading(false);
        return;
      }
      rememberDraft();
      router.push(`/rent/b/${result.secureToken}/pay`);
    } catch (err) {
      setError(t.common.somethingWrong);
      setLoading(false);
    }
  }

  if (step === "duration") {
    return (
      <div className="space-y-6">
        <StepHeader locale={locale} step={step} shopsHref={shopsHref} />

        {presetNote && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">{t.wizard.presetMissed}</p>}

        <DroneChoice locale={locale} models={models} value={model} onChange={setModel} unavailable={models.filter((m) => !availableModels.includes(m))} compare={tables?.drone} />

        <ControllerChoice
          locale={locale}
          model={model}
          options={controllerOptions}
          value={controller}
          onChange={setPickedController}
          unavailable={controllerOptions.filter((o) => !selectableControllers.includes(o))}
          compare={tables?.fly}
        />

        <ComboCard
          locale={locale}
          pictureUrl={pictures[comboKey(model, controller, batteries)]}
          depositMyr={deposit}
          alt={`${profile.shortName}, ${controllerName(controller)}, ${t.common.batteries(batteries)}`}
        />

        <DurationChoice locale={locale} value={durationHours} hourly={hourly} onChange={setDurationHours} />

        <BatteryChoice locale={locale} model={model} value={batteries} onChange={setBatteries} />

        <TotalSummary locale={locale} totalMyr={rentalFee} depositMyr={deposit} />

        <button
          type="button"
          onClick={() => {
            setSelectedStart(null);
            setPresetNote(false);
            setStep("slot");
          }}
          className={`w-full ${primaryButtonClass} h-12 rounded-full`}
        >
          {t.wizard.chooseTime}
        </button>
      </div>
    );
  }

  if (step === "slot") {
    return (
      <div className="space-y-4">
        <StepHeader locale={locale} step={step} onBack={() => setStep("duration")} />
        <p className="text-sm text-zinc-500">
          {t.wizard.pickStart(t.common.hours(durationHours), formatMyr(rentalFee))}
        </p>

        <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1" role="group" aria-label={t.wizard.day}>
          {Array.from({ length: DAYS_AHEAD }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setDayOffset(i)}
              aria-pressed={dayOffset === i}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${dayOffset === i ? selectedClass : idleClass}`}
            >
              {dayLabelFor(now, i, locale)}
            </button>
          ))}
        </div>

        {slots.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500 dark:border-zinc-700">
            {t.wizard.noMoreTimes(t.common.hours(durationHours))}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((s, i) => {
              const isUnavailable = unavailable?.has(i) ?? false;
              const isSelected = selectedStart?.getTime() === s.getTime();
              return (
                <button
                  key={s.toISOString()}
                  type="button"
                  disabled={isUnavailable || unavailable === null}
                  onClick={() => setSelectedStart(s)}
                  aria-pressed={isSelected}
                  className={`rounded-lg border py-2.5 text-sm ${
                    isSelected
                      ? selectedClass
                      : isUnavailable
                        ? "cursor-not-allowed border-zinc-100 text-zinc-300 line-through dark:border-zinc-900 dark:text-zinc-700"
                        : idleClass
                  }`}
                >
                  {formatSlotTime(s)}
                </button>
              );
            })}
          </div>
        )}
        {unavailable === null && slots.length > 0 && <p className="text-center text-xs text-zinc-400">{t.wizard.checking}</p>}
        {windNote && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {t.wizard.tooWindy(`${Math.round(windNote.worst * 10) / 10} m/s`, profile.shortName, `${windNote.limit} m/s`)}
          </p>
        )}
        {unavailable && slots.length > 0 && unavailable.size === slots.length && !windNote && (
          <p className="text-center text-xs text-zinc-500">{t.wizard.fullyBooked}</p>
        )}

        <button
          type="button"
          disabled={!selectedStart}
          onClick={() => setStep("contact")}
          className={`w-full ${primaryButtonClass} h-12 rounded-full disabled:opacity-50`}
        >
          {t.wizard.continue}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <StepHeader locale={locale} step={step} onBack={() => setStep("slot")} />
      {slotTaken && (
        <SlotTakenDialog
          locale={locale}
          onChooseAnother={() => {
            setSlotTaken(false);
            setSelectedStart(null);
            setStep("slot");
          }}
        />
      )}

      {selectedStart && (
        <div className="space-y-1 rounded-2xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          {models.length > 1 && (
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">{t.common.drone}</span>
              <span className="font-medium">{profile.shortName}</span>
            </div>
          )}
          {controllerOptions.length > 1 && (
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">{t.common.flyingWith}</span>
              <span className="font-medium">{controllerName(controller)}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">{t.common.start}</span>
            <span className="font-medium">{formatMalaysiaTime(selectedStart, locale)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">{t.common.length}</span>
            <span className="font-medium">{t.common.hours(durationHours)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">{t.common.batteriesLabel}</span>
            <span className="font-medium">{batteries}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">{t.wizard.payNow}</span>
            <span className="font-medium">{formatMyr(rentalFee)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">{t.common.depositHold}</span>
            <span className="font-medium">{formatMyr(deposit)}</span>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-3"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.common.fullName}
          autoComplete="name"
          required
          className={`w-full ${inputClass} py-3 text-base`}
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t.common.phone}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
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
        {(error ?? kycMessage) && (
          <p role="alert" className="text-center text-sm text-red-600">
            {error ?? kycMessage}
          </p>
        )}
        {idCheckPanel ?? (
          <button
            type="submit"
            disabled={loading || kycBusy || !name || !phone || !email}
            className={`w-full ${primaryButtonClass} h-12 rounded-full disabled:opacity-50`}
          >
            {loading || kycBusy ? t.wizard.booking : t.wizard.bookAndPay(formatMyr(rentalFee))}
          </button>
        )}
        <p className="text-center text-xs text-zinc-400">{t.wizard.payNext}</p>
        <p className="text-center text-xs text-zinc-400">
          <AgreeLine locale={locale} />
        </p>
        <FaqLink locale={locale} />
      </form>
    </div>
  );
}

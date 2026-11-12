"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { inputClass, pressableClass, primaryButtonClass } from "@/components/formStyles";
import { formatMalaysiaTime, type Locale } from "@/lib/i18n/locale";
import { dayLabelFor, droneText } from "@/lib/i18n/drone";
import { AgreeLine } from "@/components/droneRental/AgreeLine";
import { FaqLink } from "@/components/droneRental/FaqLink";
import { trackStep } from "@/components/FunnelBeacon";
import { WhatsAppNumberField } from "@/components/droneRental/WhatsAppNumberField";
import { Spinner } from "@/components/Spinner";
import { ControllerChoice } from "@/components/droneRental/ControllerChoice";
import { ComboCard, DiscountLines, TotalSummary } from "@/components/droneRental/ComboCard";
import type { PackagePreset } from "@/lib/droneRental/packagePreset";
import type { CompareTables } from "@/lib/droneRental/compareTables";
import { DroneChoice } from "@/components/droneRental/DroneChoice";
import { BatteryChoice, LengthChoice } from "@/components/droneRental/PackageChoices";
import { SlotTakenDialog } from "@/components/droneRental/SlotTakenDialog";
import {
  DAILY_BATTERIES,
  DEFAULT_BATTERIES,
  DRONE_MODEL_PROFILES,
  type BatteryCount,
  type ControllerKind,
  type DroneModel,
  comboKey,
  controllerLabel,
  dailyBreakdown,
  depositMyrFor,
  effectiveController,
  formatMyr,
  includesController,
  isDailyMinutes,
  rentalDays,
  offersDaily,
  rentalFeeMyr,
} from "@/lib/droneRental/pricingRules";
import { DEFAULT_SHOP_HOURS, formatSlotTime, generateDaySlots, type ShopHours } from "@/lib/droneRental/hours";
import { getUnavailableDroneStartsAction, createDroneBookingAction } from "@/app/rent/[shopId]/actions";
import { submitWalkInOrderAction } from "@/app/rent/walk-in/[code]/actions";
import type { WalkInOptions } from "@/lib/droneRental/walkInRequests";
import { useDroneKyc } from "@/components/droneRental/useDroneKyc";
import { IdCheckOption } from "@/components/droneRental/IdCheckOption";
import { EmailField, PhoneField } from "@/components/droneRental/ContactFields";
import { DRONE_ID_CHECK_ENABLED } from "@/lib/features";
import { DepositHoldNote } from "@/components/droneRental/DepositHoldNote";

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
  locale = "en",
  preset = null,
  shopsHref = "/rent",
  tables,
  hours = DEFAULT_SHOP_HOURS,
  canBook = true,
  walkInCode = null,
  nowOptions = {},
  startNow = false,
}: {
  shopId: string;
  models: DroneModel[];
  availableModels: DroneModel[];
  controllers: ControllerKind[];
  pictures: Record<string, string>;
  /** True when the customer is sent back here because the time they paid for was taken: restore what they had and go to the times. */
  retry?: boolean;
  /** A signed-in admin is testing the live site: show the skip-ID-check button. */
  /** The visitor's language. */
  locale?: Locale;
  /** A package picked on the landing page. When this shop can supply all of it the booking opens at the times; otherwise at the package step with a note. */
  preset?: PackagePreset | null;
  /** The shop list address, with the package carried along, for the "Other shops" link. */
  shopsHref?: string;
  /** The comparison tables behind the Compare buttons beside the drone and the way-to-fly choices. */
  tables?: CompareTables;
  /** This shop's opening hours: the times offered follow them, and a closed day offers none. */
  hours?: ShopHours;
  /** False on a location that only shows its rates (Check Rates): everything can be looked at and priced, but there is no button to go on to a time. */
  canBook?: boolean;
  /** This shop's walk-in code: the "Now" choice sends the shop an order under it (the shop confirms, then the customer pays). */
  walkInCode?: string | null;
  /** What can be collected right now at this shop, per drone and way of flying (empty while the shop is closed or has nothing free). */
  nowOptions?: WalkInOptions;
  /** Opened from the shop's own QR: "Now" is already chosen on the times page. */
  startNow?: boolean;
}) {
  const t = droneText(locale);
  const router = useRouter();
  // The package from the landing page: used as it is when this shop has the drone and the controller, and ignored where it does not.
  const presetModel = preset && availableModels.includes(preset.model) ? preset.model : null;
  const presetController = preset && presetModel && (preset.controller === "NONE" || controllers.includes(preset.controller)) ? preset.controller : null;
  const presetFits = canBook && !!preset && presetModel === preset.model && presetController === preset.controller;
  const [presetNote, setPresetNote] = useState(!!preset && !presetFits);
  const [step, setStep] = useState<Step>(presetFits ? "slot" : "duration");
  const [model, setModel] = useState<DroneModel>(presetModel ?? (availableModels.includes("NEO2") ? "NEO2" : (availableModels[0] ?? models[0])));
  // How long, in minutes: a whole number of hours, or of days (1440 minutes each, with 3 batteries and a charger included).
  const [durationMinutes, setDurationMinutes] = useState(preset?.minutes ?? 60);
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
  // "Now": collect it at the shop right away. It goes in as an order the shop confirms (the walk-in flow), and starts at handover.
  const [wantsNow, setWantsNow] = useState(startNow);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slotTaken, setSlotTaken] = useState(false);

  // Which step of the booking each visit reaches (Admin > Drone Funnel).
  useEffect(() => {
    trackStep(step === "duration" ? "PACKAGE" : step === "slot" ? "TIME" : "DETAILS", shopId);
  }, [step, shopId]);

  const byDay = isDailyMinutes(durationMinutes);
  const returnTime = selectedStart ? new Date(selectedStart.getTime() + durationMinutes * 60_000) : null;
  const profile = DRONE_MODEL_PROFILES[model];
  // Every way of flying is listed; those the shop has none of are greyed out and never chosen. By the day the goggles set is not offered.
  const controllerOptions = profile.controllerOptions;
  const selectableControllers = controllerOptions.filter((o) => (o === "NONE" || controllers.includes(o)) && (!byDay || offersDaily(model, o)));
  const asked = effectiveController(model, pickedController);
  const controller = selectableControllers.includes(asked) ? asked : selectableControllers[0];
  const withController = includesController(model, controller);
  // "Now" is there only while the shop is open with a drone free, and only for a choice (drone, way of flying, length) it can hand over right now.
  const nowShown = !!walkInCode && Object.keys(nowOptions).length > 0;
  const nowAvailable = nowShown && (nowOptions[model]?.[controller] ?? []).includes(durationMinutes);
  const nowChosen = wantsNow && nowAvailable;
  // Verify identity: only 40% of the deposit is held (the choice shows only while the ID check is switched on).
  const [idCheck, setIdCheck] = useState(false);
  const idChecked = DRONE_ID_CHECK_ENABLED && idCheck;
  const fullDeposit = depositMyrFor(model, controller);
  const deposit = depositMyrFor(model, controller, idChecked);
  const rentalFee = rentalFeeMyr(durationMinutes, batteries, model, controller);
  const breakdown = dailyBreakdown(durationMinutes, model, controller);
  /** "Phone only" in the visitor's language, or the controller's own name (a product name, never translated). */
  const controllerName = (kind: ControllerKind) => (kind === "NONE" ? t.common.phoneOnly : controllerLabel(model, kind));

  // (Re)draw the grid for the chosen day and duration, then grey out what's taken. The grid itself is
  // worked out in Malaysia time (lib/droneRental/hours) so it's right whatever timezone the phone is in;
  // the server stays the authority on what's actually bookable.
  useEffect(() => {
    if (step !== "slot") return;
    const current = new Date();
    const candidates = generateDaySlots(current, dayOffset, durationMinutes, hours);
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
  }, [step, shopId, model, controller, durationMinutes, dayOffset, hours]);

  // Coming back after losing the last drone: put their choices and details back, ready to pick another time.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      sessionStorage.removeItem(DRAFT_KEY);
      if (!retry || !raw) return;
      const d = JSON.parse(raw) as Partial<{ shopId: string; model: DroneModel; controller: ControllerKind; durationMinutes: number; durationHours: number; batteries: BatteryCount; dayOffset: number; name: string; phone: string; email: string }>;
      if (d.shopId !== shopId) return;
      if (d.model && models.includes(d.model)) setModel(d.model);
      if (d.controller) setPickedController(d.controller);
      if (typeof d.durationMinutes === "number") setDurationMinutes(d.durationMinutes);
      else if (typeof d.durationHours === "number") setDurationMinutes(d.durationHours * 60);
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
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ shopId, model, controller, durationMinutes, batteries, dayOffset, name, phone, email }));
    } catch {
      // Nothing to remember it in: they would start again, nothing worse.
    }
  }

  const { verifyThen, panel: idCheckPanel, kycBusy, kycMessage } = useDroneKyc({ locale });

  /** The first thing "Book and pay" does: the ID check. The booking itself is made once it has passed. */
  function submit() {
    if (!selectedStart && !nowChosen) return;
    setError(null);
    trackStep("ID_CHECK", shopId);
    void verifyThen({ name, phone, email }, placeBooking, idChecked);
  }

  /** "Now": the order goes to the shop to confirm, then the customer pays (card, cash or QR) and collects. */
  async function sendNowOrder(verificationId: string) {
    if (!walkInCode) return;
    setLoading(true);
    setError(null);
    try {
      const result = await submitWalkInOrderAction({ code: walkInCode, durationMinutes, batteries: byDay ? DEFAULT_BATTERIES : batteries, model, controller, name, phone, email, verificationId, whatsappNumber });
      if (result.ok) {
        router.push(`/rent/w/${result.token}`);
        return;
      }
      setError(result.message);
    } catch {
      setError(t.common.somethingWrong);
    }
    setLoading(false);
  }

  async function placeBooking(verificationId: string) {
    if (nowChosen) return sendNowOrder(verificationId);
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
        whatsappNumber,
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

        <DroneChoice locale={locale} daily={byDay} days={rentalDays(durationMinutes)} controller={controller} models={models} value={model} onChange={setModel} unavailable={models.filter((m) => !availableModels.includes(m))} compare={tables?.drone} />

        <ControllerChoice
          locale={locale}
          model={model}
          options={controllerOptions}
          value={controller}
          onChange={setPickedController}
          unavailable={controllerOptions.filter((o) => !selectableControllers.includes(o))}
          compare={tables?.fly}
          daily={byDay}
          days={rentalDays(durationMinutes)}
        />

        <LengthChoice locale={locale} minutes={durationMinutes} model={model} controller={controller} onChange={setDurationMinutes} />

        <ComboCard
          locale={locale}
          pictureUrl={pictures[comboKey(model, controller, byDay ? DAILY_BATTERIES : batteries)]}
          depositMyr={deposit}
          alt={`${profile.shortName}, ${controllerName(controller)}${byDay ? "" : `, ${t.common.batteries(batteries)}`}`}
        />

        {!byDay && <BatteryChoice locale={locale} model={model} value={batteries} onChange={setBatteries} />}

        <TotalSummary locale={locale} totalMyr={rentalFee} depositMyr={deposit} breakdown={breakdown} />
        <IdCheckOption locale={locale} checked={idCheck} onChange={setIdCheck} fullMyr={fullDeposit} reducedMyr={depositMyrFor(model, controller, true)} />

        {canBook && (
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
        )}
      </div>
    );
  }

  if (step === "slot") {
    return (
      <div className="space-y-4">
        <StepHeader locale={locale} step={step} onBack={() => setStep("duration")} />
        <p className="text-sm text-zinc-500">
          {t.wizard.pickStart(t.common.rentalLength(durationMinutes), formatMyr(rentalFee))}
        </p>

        <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1" role="group" aria-label={t.wizard.day}>
          {nowShown && (
            <button
              type="button"
              disabled={!nowAvailable}
              onClick={() => {
                setWantsNow(true);
                setSelectedStart(null);
              }}
              aria-pressed={nowChosen}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${nowChosen ? selectedClass : nowAvailable ? idleClass : "cursor-not-allowed border-zinc-100 text-zinc-300 dark:border-zinc-900 dark:text-zinc-700"}`}
            >
              {t.wizard.now}
            </button>
          )}
          {Array.from({ length: DAYS_AHEAD }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setWantsNow(false);
                setDayOffset(i);
              }}
              aria-pressed={!nowChosen && dayOffset === i}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${!nowChosen && dayOffset === i ? selectedClass : idleClass}`}
            >
              {dayLabelFor(now, i, locale)}
            </button>
          ))}
        </div>

        {wantsNow && !nowAvailable && <p className="text-center text-xs text-zinc-500">{t.wizard.nowUnavailable}</p>}

        {nowChosen ? (
          <p className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">{t.wizard.nowNote}</p>
        ) : slots.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500 dark:border-zinc-700">
            {t.wizard.noMoreTimes(t.common.rentalLength(durationMinutes))}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((s, i) => {
              const isUnavailable = unavailable?.has(i) ?? false;
              const isSelected = selectedStart?.getTime() === s.getTime();
              // Every half hour the rental covers, from the chosen start until it ends, is lit up with it.
              const inRental = !byDay && !!selectedStart && s.getTime() > selectedStart.getTime() && s.getTime() < selectedStart.getTime() + durationMinutes * 60_000;
              return (
                <button
                  key={s.toISOString()}
                  type="button"
                  disabled={isUnavailable || unavailable === null}
                  onClick={() => setSelectedStart(s)}
                  aria-pressed={isSelected}
                  className={`rounded-lg border py-3 text-base ${
                    isSelected
                      ? selectedClass
                      : inRental
                        ? "border-zinc-500 bg-zinc-500 font-medium text-white dark:border-zinc-400 dark:bg-zinc-400 dark:text-black"
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
        {selectedStart && returnTime && (
          <p className="text-center text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            {byDay ? `${t.common.returnBy} ${formatMalaysiaTime(returnTime, locale)}` : `${formatSlotTime(selectedStart)} – ${formatSlotTime(returnTime)}`}
          </p>
        )}
        {!nowChosen && unavailable === null && slots.length > 0 && <p className="text-center text-xs text-zinc-400">{t.wizard.checking}</p>}
        {!nowChosen && windNote && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {t.wizard.tooWindy(`${Math.round(windNote.worst * 10) / 10} m/s`, profile.shortName, `${windNote.limit} m/s`)}
          </p>
        )}
        {!nowChosen && unavailable && slots.length > 0 && unavailable.size === slots.length && !windNote && (
          <p className="text-center text-xs text-zinc-500">{t.wizard.fullyBooked}</p>
        )}

        <button
          type="button"
          disabled={!selectedStart && !nowChosen}
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

      {(selectedStart || nowChosen) && (
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
            <span className="font-medium">{selectedStart ? formatMalaysiaTime(selectedStart, locale) : t.wizard.nowStart}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">{t.common.length}</span>
            <span className="font-medium">{t.common.rentalLength(durationMinutes)}</span>
          </div>
          {byDay && returnTime && (
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">{t.common.returnBy}</span>
              <span className="font-medium">{formatMalaysiaTime(returnTime, locale)}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">{t.common.batteriesLabel}</span>
            <span className="font-medium">{byDay ? t.common.batteriesAndCharger(DAILY_BATTERIES) : batteries}</span>
          </div>
          <DiscountLines breakdown={breakdown} locale={locale} />
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">{t.wizard.payNow}</span>
            <span className="font-medium">{formatMyr(rentalFee)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">{t.common.depositHold}</span>
            <span className="font-medium">{formatMyr(deposit)}</span>
          </div>
          <DepositHoldNote depositMyr={deposit} locale={locale} />
          <IdCheckOption locale={locale} checked={idCheck} onChange={setIdCheck} fullMyr={fullDeposit} reducedMyr={depositMyrFor(model, controller, true)} />
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs leading-snug text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">{t.common.damageWarning}</p>
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
        <PhoneField value={phone} onChange={setPhone} locale={locale} />
        <EmailField value={email} onChange={setEmail} locale={locale} />
        <WhatsAppNumberField value={whatsappNumber} onChange={setWhatsappNumber} locale={locale} />
        {(error ?? kycMessage) && (
          <p role="alert" className="text-center text-sm text-red-600">
            {error ?? kycMessage}
          </p>
        )}
        {idCheckPanel ?? (
          <button
            type="submit"
            disabled={loading || kycBusy || !name || !phone || !email}
            className={`flex w-full items-center justify-center gap-2 ${primaryButtonClass} h-12 rounded-full disabled:opacity-50`}
          >
            {(loading || kycBusy) && <Spinner />}
            {loading || kycBusy ? t.wizard.booking : nowChosen ? t.wizard.sendOrder : t.wizard.bookAndPay(formatMyr(rentalFee))}
          </button>
        )}
        {!nowChosen && <p className="text-center text-xs text-zinc-400">{t.wizard.payNext}</p>}
        <p className="text-center text-xs text-zinc-400">
          <AgreeLine locale={locale} />
        </p>
        <FaqLink locale={locale} />
      </form>
    </div>
  );
}

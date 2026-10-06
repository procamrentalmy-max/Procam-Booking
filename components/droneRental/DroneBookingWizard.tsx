"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import {
  BATTERY_OPTIONS,
  DEFAULT_BATTERIES,
  DRONE_MODEL_PROFILES,
  type BatteryCount,
  type DroneModel,
  depositMyrFor,
  formatMyr,
  hourlyRateFor,
  includesController,
  rentalFeeMyr,
} from "@/lib/droneRental/pricingRules";
import { dayLabel, formatSlotTime, generateDaySlots } from "@/lib/droneRental/hours";
import { getUnavailableDroneStartsAction, createDroneBookingAction } from "@/app/rent/[shopId]/actions";

const DURATION_OPTIONS_HOURS = [1, 2, 3, 4, 5, 6];
const DAYS_AHEAD = 7;

type Step = "duration" | "slot" | "contact";

const selectedClass = "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black";
const idleClass = "border-zinc-300 dark:border-zinc-700";

function StepHeader({ step, onBack }: { step: Step; onBack?: () => void }) {
  const n = step === "duration" ? 1 : step === "slot" ? 2 : 3;
  return (
    <div className="flex h-6 items-center justify-between text-xs text-zinc-500">
      {onBack ? (
        <button type="button" onClick={onBack} className="-ml-1 px-1 py-1 text-sm underline underline-offset-2">
          ← Back
        </button>
      ) : (
        <Link href="/rent" className="-ml-1 px-1 py-1 text-sm underline underline-offset-2">
          ← Other shops
        </Link>
      )}
      <span>Step {n} of 3</span>
    </div>
  );
}

export function DroneBookingWizard({ shopId, models }: { shopId: string; models: DroneModel[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("duration");
  const [model, setModel] = useState<DroneModel>(models.includes("NEO2") ? "NEO2" : models[0]);
  const [durationHours, setDurationHours] = useState(1);
  const [batteries, setBatteries] = useState<BatteryCount>(DEFAULT_BATTERIES);
  // Only some drones can be rented without their controller; the others always come with it.
  const [wantsController, setWantsController] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [dayOffset, setDayOffset] = useState(0);
  const [slots, setSlots] = useState<Date[]>([]);
  const [unavailable, setUnavailable] = useState<Set<number> | null>(null);
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const durationMinutes = durationHours * 60;
  const profile = DRONE_MODEL_PROFILES[model];
  const withController = includesController(model, wantsController);
  const hourly = hourlyRateFor(model, withController);
  const deposit = depositMyrFor(model, withController);
  const rentalFee = rentalFeeMyr(durationMinutes, batteries, model, withController);

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
    let cancelled = false;
    getUnavailableDroneStartsAction({ shopId, model, durationMinutes, starts: candidates.map((d) => d.toISOString()) })
      .then((result) => {
        if (cancelled) return;
        const bad = new Set<number>();
        result.unavailable.forEach((isBad, i) => {
          if (isBad) bad.add(i);
        });
        setUnavailable(bad);
      })
      .catch(() => {
        if (!cancelled) setUnavailable(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [step, shopId, model, durationMinutes, dayOffset]);

  async function submit() {
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
        withController,
        name,
        phone,
        email,
      });
      router.push(`/rent/b/${result.secureToken}/pay`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
      setLoading(false);
    }
  }

  if (step === "duration") {
    return (
      <div className="space-y-6">
        <StepHeader step={step} />

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

        {profile.controllerOptional && (
          <div>
            <p className="mb-2 text-sm font-medium">Controller?</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { with: false, title: "Drone only", note: "Phone only" },
                { with: true, title: "With controller", note: "Controller + phone" },
              ].map((o) => (
                <button
                  key={o.title}
                  type="button"
                  onClick={() => setWantsController(o.with)}
                  aria-pressed={withController === o.with}
                  className={`rounded-xl border px-3 py-3 text-center ${withController === o.with ? selectedClass : idleClass}`}
                >
                  <span className="block text-sm font-semibold">{o.title}</span>
                  <span className={`block text-xs ${withController === o.with ? "opacity-80" : "text-zinc-500"}`}>
                    {formatMyr(hourlyRateFor(model, o.with))} per hour · {o.note}
                  </span>
                </button>
              ))}
            </div>
            {!withController && <p className="mt-2 text-xs text-zinc-500">You fly it from your own phone with the DJI Fly app, so bring a phone with it installed.</p>}
          </div>
        )}

        <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
          <p className="font-semibold text-black dark:text-zinc-50">{withController ? profile.name : profile.shortName}</p>
          <p className="mt-0.5 text-sm text-zinc-500">{formatMyr(hourly)} per hour, plus batteries</p>
          <ul className="mt-4 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            <li>{withController ? "Drone and controller" : "The drone"}, with the batteries you choose, all charged at the shop</li>
            <li>
              {formatMyr(deposit)} deposit: a hold on your card, not a charge (drone {formatMyr(profile.depositDroneMyr)}
              {withController && <>, controller {formatMyr(profile.depositControllerMyr)}</>}). Released when everything comes back in good condition
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">How long do you need it?</p>
          <div className="grid grid-cols-3 gap-2">
            {DURATION_OPTIONS_HOURS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setDurationHours(h)}
                aria-pressed={durationHours === h}
                className={`rounded-xl border py-3 text-center ${durationHours === h ? selectedClass : idleClass}`}
              >
                <span className="block text-sm font-semibold">{h} hour{h === 1 ? "" : "s"}</span>
                <span className={`block text-xs ${durationHours === h ? "opacity-80" : "text-zinc-500"}`}>{formatMyr(h * hourly)}</span>
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
          <p className="mt-2 text-xs text-zinc-500">
            Your hours are time with the drone, not flying time. Battery running low? Swap it for a fully charged one at the shop: {formatMyr(profile.batteryFeeMyr[1])} for 1, {formatMyr(profile.batteryFeeMyr[2])} for 2.
          </p>
        </div>

        <p className="text-center text-sm text-zinc-500">
          Rental fee: <span className="font-semibold text-black dark:text-zinc-50">{formatMyr(rentalFee)}</span>
        </p>

        <button
          type="button"
          onClick={() => {
            setSelectedStart(null);
            setStep("slot");
          }}
          className={`w-full ${primaryButtonClass} h-12 rounded-full`}
        >
          Choose a time
        </button>
      </div>
    );
  }

  if (step === "slot") {
    return (
      <div className="space-y-4">
        <StepHeader step={step} onBack={() => setStep("duration")} />
        <p className="text-sm text-zinc-500">
          {durationHours} hour{durationHours === 1 ? "" : "s"} · {formatMyr(rentalFee)} · pick a start time (Malaysia time)
        </p>

        <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1" role="group" aria-label="Day">
          {Array.from({ length: DAYS_AHEAD }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setDayOffset(i)}
              aria-pressed={dayOffset === i}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${dayOffset === i ? selectedClass : idleClass}`}
            >
              {dayLabel(now, i)}
            </button>
          ))}
        </div>

        {slots.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No more start times today for {durationHours} hour{durationHours === 1 ? "" : "s"}. Try another day.
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
        {unavailable === null && slots.length > 0 && <p className="text-center text-xs text-zinc-400">Checking availability…</p>}
        {unavailable && slots.length > 0 && unavailable.size === slots.length && (
          <p className="text-center text-xs text-zinc-500">Fully booked this day. Try another day or another shop.</p>
        )}

        <button
          type="button"
          disabled={!selectedStart}
          onClick={() => setStep("contact")}
          className={`w-full ${primaryButtonClass} h-12 rounded-full disabled:opacity-50`}
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <StepHeader step={step} onBack={() => setStep("slot")} />

      {selectedStart && (
        <div className="space-y-1 rounded-2xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          {models.length > 1 && (
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Drone</span>
              <span className="font-medium">{profile.shortName}</span>
            </div>
          )}
          {profile.controllerOptional && (
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Controller</span>
              <span className="font-medium">{withController ? "Included" : "No, phone only"}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Start</span>
            <span className="font-medium">{formatMalaysiaTime(selectedStart, "en")}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Length</span>
            <span className="font-medium">
              {durationHours} hour{durationHours === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Batteries</span>
            <span className="font-medium">{batteries}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Pay now</span>
            <span className="font-medium">{formatMyr(rentalFee)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Deposit hold</span>
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
          placeholder="Full name"
          autoComplete="name"
          required
          className={`w-full ${inputClass} py-3 text-base`}
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
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
        {error && (
          <p role="alert" className="text-center text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !name || !phone || !email}
          className={`w-full ${primaryButtonClass} h-12 rounded-full disabled:opacity-50`}
        >
          {loading ? "Booking…" : `Book and pay ${formatMyr(rentalFee)}`}
        </button>
        <p className="text-center text-xs text-zinc-400">You&apos;ll pay on the next page. Nothing is charged until then.</p>
      </form>
    </div>
  );
}

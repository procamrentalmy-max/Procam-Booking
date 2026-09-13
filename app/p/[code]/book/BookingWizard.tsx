"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DiditSdk } from "@didit-protocol/sdk-web";
import type { Locale } from "@/lib/i18n/locale";
import { formatDateTime } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { Brand } from "@/components/Brand";
import {
  startKycAction,
  confirmKycAction,
  devSkipKycAction,
  createBookingAction,
  checkPhoneCompatibilityAction,
  getUnavailableStartsAction,
} from "./actions";

type RentalPackage = {
  id: string;
  name: string;
  price_myr: number;
  deposit_myr: number;
  duration_minutes: number;
  is_overnight: boolean;
};

type Step = "package" | "locations" | "contact" | "phone" | "verify" | "confirm" | "booked";
type Mode = "daytime" | "overnight" | "multiday";

/** Anything at or beyond a full day is offered as a multi-day duration pick, not the same-day start/end grid. */
const MULTIDAY_THRESHOLD_MINUTES = 24 * 60;

type LockerPartner = { id: string; name: string };

/** 8am-9pm — matches the locker network's operating hours; the server is the real authority on what's actually feasible. */
const OPERATING_HOURS = Array.from({ length: 14 }, (_, i) => i + 8);
const MIN_LEAD_MINUTES = 120;

function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The Date a given operating hour resolves to on the selected day — shared by the availability check and the final submitted request so they always mean the same instant. */
function hourStart(date: string, hour: number): Date {
  return new Date(`${date}T${String(hour).padStart(2, "0")}:00`);
}

/** A same-or-next-day, operating-hours default at least MIN_LEAD_MINUTES out — a starting point, not a guarantee; the server re-validates and may push it further. */
function defaultDateAndHour(): { date: string; hour: number } {
  const earliest = new Date(Date.now() + MIN_LEAD_MINUTES * 60_000);
  let hour = earliest.getMinutes() > 0 ? earliest.getHours() + 1 : earliest.getHours();
  const date = new Date(earliest);
  if (hour > OPERATING_HOURS[OPERATING_HOURS.length - 1]) {
    date.setDate(date.getDate() + 1);
    hour = OPERATING_HOURS[0];
  } else if (hour < OPERATING_HOURS[0]) {
    hour = OPERATING_HOURS[0];
  }
  return { date: toDateInputValue(date), hour };
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
}

export function BookingWizard({
  locale,
  logoUrl,
  partnerId,
  referralCode,
  productId,
  productName,
  requiresPhoneCompatibility,
  packages,
  lockerPartners,
  termsVersionId,
  termsBody,
}: {
  locale: Locale;
  logoUrl: string | null;
  partnerId: string;
  referralCode: string;
  productId: string;
  productName: string;
  requiresPhoneCompatibility: boolean;
  packages: RentalPackage[];
  lockerPartners: LockerPartner[];
  termsVersionId: string | null;
  termsBody: string | null;
}) {
  const router = useRouter();
  const dict = getDictionary(locale);
  const t = dict.booking;
  const dateInputRef = useRef<HTMLInputElement>(null);
  const daytimePackages = [...packages]
    .filter((p) => !p.is_overnight && p.duration_minutes < MULTIDAY_THRESHOLD_MINUTES)
    .sort((a, b) => a.duration_minutes - b.duration_minutes);
  const multidayPackages = [...packages]
    .filter((p) => !p.is_overnight && p.duration_minutes >= MULTIDAY_THRESHOLD_MINUTES)
    .sort((a, b) => a.duration_minutes - b.duration_minutes);
  const overnightPackage = packages.find((p) => p.is_overnight) ?? null;

  const [step, setStep] = useState<Step>("package");
  const [mode, setMode] = useState<Mode>(
    daytimePackages.length > 0 ? "daytime" : overnightPackage ? "overnight" : "multiday"
  );
  const initialDefault = defaultDateAndHour();
  const [date, setDate] = useState(initialDefault.date);
  const [startHour, setStartHour] = useState<number | null>(null);
  const [endHour, setEndHour] = useState<number | null>(null);
  const [multidayPackageId, setMultidayPackageId] = useState<string>("");
  // Default to wherever the customer scanned in from — changeable to any
  // other active locker location for a one-way rental.
  const [pickupPartnerId, setPickupPartnerId] = useState(partnerId);
  const [dropoffPartnerId, setDropoffPartnerId] = useState(partnerId);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [variant, setVariant] = useState("");
  const [phoneCompatible, setPhoneCompatible] = useState<boolean | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [secureToken, setSecureToken] = useState<string | null>(null);
  const [assignedTime, setAssignedTime] = useState<{ start: string; end: string } | null>(null);
  // null while the check is in flight (or hasn't run yet) — treated as "don't know
  // yet" rather than "all unavailable", so the grid doesn't flash fully dulled.
  const [engineUnavailableHours, setEngineUnavailableHours] = useState<Set<number> | null>(null);

  // Re-checked whenever the date changes: which hours currently have zero
  // eligible camera for even the shortest (1hr) rental. A cheap proxy for
  // "don't bother tapping this one" — the real gate is still whatever
  // createBookingAction's checkLockerBookingFeasibility decides at submit.
  useEffect(() => {
    if (mode !== "daytime") return;
    let cancelled = false;
    setEngineUnavailableHours(null);
    const starts = OPERATING_HOURS.map((h) => ({ hour: h, iso: hourStart(date, h).toISOString() }));
    getUnavailableStartsAction({ productId, starts: starts.map((s) => s.iso) })
      .then((result) => {
        if (cancelled) return;
        const unavailableIsos = new Set(result.unavailable);
        setEngineUnavailableHours(new Set(starts.filter((s) => unavailableIsos.has(s.iso)).map((s) => s.hour)));
      })
      .catch(() => {
        // Fail open — an unknown availability check shouldn't block booking.
        if (!cancelled) setEngineUnavailableHours(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [date, mode, productId]);

  function isPastLeadTime(hour: number): boolean {
    return hourStart(date, hour).getTime() < Date.now() + MIN_LEAD_MINUTES * 60_000 - 60_000;
  }

  function isHourUnavailable(hour: number): boolean {
    return isPastLeadTime(hour) || (engineUnavailableHours?.has(hour) ?? false);
  }

  // The customer picks a start hour and an end hour directly — the package
  // (and so the price) is whichever one matches that exact duration. Every
  // whole-hour duration from 1 to 13 hours has a seeded package (see
  // seed.sql), so any start/end pair within OPERATING_HOURS resolves to a
  // real, priced package rather than a fixed handful of named tiers.
  const daytimeSelectedPackage =
    startHour !== null && endHour !== null
      ? daytimePackages.find((p) => p.duration_minutes === (endHour - startHour) * 60)
      : undefined;
  const multidaySelectedPackage = multidayPackages.find((p) => p.id === multidayPackageId);
  const selectedPackage =
    mode === "overnight" ? (overnightPackage ?? undefined) : mode === "multiday" ? multidaySelectedPackage : daytimeSelectedPackage;
  const packageId = selectedPackage?.id ?? "";

  /** Computed fresh at submit time — the server is the real authority; this is what we're requesting, not a guarantee. */
  function resolveEarliestStartTime(): Date {
    if (selectedPackage?.is_overnight) {
      const combined = new Date(`${date}T22:00`);
      return Number.isNaN(combined.getTime()) ? new Date() : combined;
    }
    const combined = hourStart(date, startHour ?? 0);
    return Number.isNaN(combined.getTime()) ? new Date() : combined;
  }

  function selectMode(next: Mode) {
    setMode(next);
    setStartHour(null);
    setEndHour(null);
    setMultidayPackageId("");
  }

  /**
   * One shared set of hour slots for both ends of the range: the first tap
   * (or a tap once a range is already complete) sets the start; a second
   * tap on a later hour sets the end; a tap on an earlier hour restarts the
   * range from there instead. In multi-day mode there's no end hour at all —
   * the duration comes from a separately picked package, so a tap just sets
   * the start.
   */
  function tapHour(h: number) {
    if (isHourUnavailable(h)) return;
    if (mode === "multiday") {
      setStartHour(h);
      return;
    }
    if (startHour === null || endHour !== null) {
      setStartHour(h);
      setEndHour(null);
      return;
    }
    if (h > startHour) {
      setEndHour(h);
    } else if (h < startHour) {
      setStartHour(h);
    }
  }

  /** Opens Didit's hosted verification modal — an iframe overlay, so the wizard's own state (package, times, locations already chosen) stays mounted underneath it the whole time. */
  function openDiditModal(url: string, verifId: string) {
    DiditSdk.shared.onComplete = async (result) => {
      if (result.type === "completed") {
        try {
          const confirm = await confirmKycAction({ verificationId: verifId, partnerId: pickupPartnerId, locale });
          if (confirm.verified) {
            setStep("confirm");
          } else {
            setError(t.errors.verificationNotApproved);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : dict.common.somethingWentWrong);
        } finally {
          setLoading(false);
        }
      } else if (result.type === "cancelled") {
        // Nothing to do — the wizard's "verify" step is still showing underneath, ready to try again.
      } else {
        setError(result.error?.message ?? t.errors.verificationFailed);
      }
    };
    DiditSdk.shared.startVerification({ url });
  }

  async function skipVerificationForTesting() {
    if (!verificationId) return;
    setLoading(true);
    setError(null);
    try {
      await devSkipKycAction({ verificationId, partnerId: pickupPartnerId, locale });
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.common.somethingWentWrong);
    } finally {
      setLoading(false);
    }
  }

  async function beginKyc() {
    setLoading(true);
    setError(null);
    try {
      const result = await startKycAction({ name, phone, email, partnerId: pickupPartnerId, locale });
      setCustomerId(result.customerId);
      setVerificationId(result.verificationId);
      setSessionUrl(result.sessionUrl);
      // KYC_BYPASS_ENABLED: startKycAction already marked this VERIFIED and skipped Didit — nothing to show, go straight through.
      setStep(result.sessionUrl ? "verify" : "confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.common.somethingWentWrong);
    } finally {
      setLoading(false);
    }
  }

  function handlePackageSubmit() {
    setError(null);
    if (!packageId) {
      setError(t.errors.selectPackage);
      return;
    }
    if (resolveEarliestStartTime().getTime() < Date.now() + MIN_LEAD_MINUTES * 60_000 - 60_000) {
      setError(t.errors.minNotice(MIN_LEAD_MINUTES / 60));
      return;
    }
    setStep("locations");
  }

  function handleLocationsSubmit() {
    setError(null);
    if (!pickupPartnerId || !dropoffPartnerId) {
      setError(t.errors.selectLocations);
      return;
    }
    setStep("contact");
  }

  async function handleContactSubmit() {
    setError(null);
    if (requiresPhoneCompatibility) {
      setStep("phone");
      return;
    }
    await beginKyc();
  }

  async function handleCheckCompatibility() {
    setError(null);
    setLoading(true);
    try {
      const result = await checkPhoneCompatibilityAction({ productId, manufacturer, model, variant });
      setPhoneCompatible(result.compatible);
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.common.somethingWentWrong);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!customerId || !verificationId) return;
    setError(null);
    setLoading(true);
    try {
      const requested = resolveEarliestStartTime();
      const result = await createBookingAction({
        customerId,
        verificationId,
        partnerId: pickupPartnerId,
        dropoffPartnerId,
        rentalPackageId: packageId,
        referralCode,
        startTime: requested.toISOString(),
        termsVersionId,
        locale,
      });
      // The engine may have assigned a different slot than requested — show
      // the customer what they actually got before sending them to pay,
      // rather than silently redirecting past a surprise.
      const assignedStart = new Date(result.startTime);
      if (Math.abs(assignedStart.getTime() - requested.getTime()) > 60_000) {
        setSecureToken(result.secureToken);
        setAssignedTime({ start: result.startTime, end: result.endTime });
        setStep("booked");
      } else {
        router.push(`/r/${result.secureToken}/deposit-notice`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.common.somethingWentWrong);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="flex justify-center">
        <Brand logoUrl={logoUrl} size={22} />
      </div>

      <h1 className="text-center text-xl font-semibold text-black dark:text-zinc-50">
        {step === "package" && productName}
        {step === "locations" && t.stepTitles.locations}
        {step === "contact" && t.stepTitles.contact}
        {step === "phone" && t.stepTitles.phone}
        {step === "verify" && t.stepTitles.verify}
        {step === "confirm" && t.stepTitles.confirm}
        {step === "booked" && t.stepTitles.booked}
      </h1>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      {step === "package" && (
        <div className="space-y-5">
          {/* Price chart — reference only; the actual pick happens in the timetable below. Full list, no scrolling. */}
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900">
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">{t.table.duration}</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-500">{t.table.price}</th>
                </tr>
              </thead>
              <tbody>
                {[...daytimePackages, ...(overnightPackage ? [overnightPackage] : []), ...multidayPackages].map((pkg) => (
                  <tr key={pkg.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-2">{pkg.name}</td>
                    <td className="px-4 py-2 text-right font-semibold">RM{pkg.price_myr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(() => {
            const modeOptions: { key: Mode; label: string }[] = [
              ...(daytimePackages.length > 0 ? [{ key: "daytime" as const, label: t.mode.daytime }] : []),
              ...(overnightPackage ? [{ key: "overnight" as const, label: t.mode.overnight }] : []),
              ...(multidayPackages.length > 0 ? [{ key: "multiday" as const, label: t.mode.multiday }] : []),
            ];
            if (modeOptions.length < 2) return null;
            return (
              <div className="flex gap-2">
                {modeOptions.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => selectMode(opt.key)}
                    className={`flex-1 rounded-full border py-2 text-sm font-medium ${
                      mode === opt.key
                        ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                        : "border-zinc-300 dark:border-zinc-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            );
          })()}

          <div className="space-y-2">
            <p className="text-xs text-zinc-500">
              {mode === "overnight" ? t.hint.overnight : mode === "multiday" ? t.hint.multiday : t.hint.daytime}
            </p>
            <input
              ref={dateInputRef}
              type="date"
              value={date}
              min={toDateInputValue(new Date())}
              onChange={(e) => setDate(e.target.value)}
              // Native <input type="date"> only opens its picker when you
              // hit the small calendar icon — showPicker() makes a click
              // anywhere on the field do it. Guarded: showPicker isn't in
              // every browser (notably Safari), so a plain click still
              // falls back to normal text-field behavior there.
              onClick={() => dateInputRef.current?.showPicker?.()}
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
            />

            {(mode === "daytime" || mode === "multiday") && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                  {mode === "multiday"
                    ? t.timetable.tapStart
                    : startHour === null
                      ? t.timetable.tapStart
                      : endHour === null
                        ? t.timetable.tapEnd
                        : t.timetable.tapRestart}
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {OPERATING_HOURS.map((h) => {
                    const unavailable = isHourUnavailable(h);
                    const inRange = startHour !== null && endHour !== null && h >= startHour && h <= endHour;
                    const isEdge = h === startHour || h === endHour;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => tapHour(h)}
                        disabled={unavailable}
                        aria-disabled={unavailable}
                        className={`rounded-lg border py-2 text-sm ${
                          unavailable
                            ? "cursor-not-allowed border-zinc-300 bg-zinc-300 text-black line-through dark:border-zinc-700 dark:bg-zinc-700 dark:text-zinc-500"
                            : isEdge
                              ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                              : inRange
                                ? "border-zinc-400 bg-zinc-200 dark:border-zinc-500 dark:bg-zinc-700"
                                : "border-zinc-300 dark:border-zinc-700"
                        }`}
                      >
                        {formatHour(h)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {mode === "multiday" && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">{t.timetable.chooseDuration}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {multidayPackages.map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setMultidayPackageId(pkg.id)}
                      className={`rounded-lg border py-2 text-sm ${
                        multidayPackageId === pkg.id
                          ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                          : "border-zinc-300 dark:border-zinc-700"
                      }`}
                    >
                      {pkg.name} — RM{pkg.price_myr}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Price for the selected slot — shown at the bottom, right above Continue. */}
          {selectedPackage && (
            <div className="rounded-lg bg-zinc-50 p-3 text-center dark:bg-zinc-900">
              <p className="text-sm text-zinc-500">{selectedPackage.name}</p>
              <p className="text-lg font-semibold text-black dark:text-zinc-50">RM{selectedPackage.price_myr}</p>
            </div>
          )}

          <button
            onClick={handlePackageSubmit}
            disabled={loading || !selectedPackage}
            className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {dict.common.continue}
          </button>
        </div>
      )}

      {step === "locations" && (
        <div className="space-y-4">
          <p className="text-center text-sm text-zinc-500">{t.locations.hint}</p>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t.locations.pickup}</label>
            <select
              value={pickupPartnerId}
              onChange={(e) => setPickupPartnerId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {lockerPartners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t.locations.dropoff}</label>
            <select
              value={dropoffPartnerId}
              onChange={(e) => setDropoffPartnerId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {lockerPartners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleLocationsSubmit}
            disabled={loading}
            className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {dict.common.continue}
          </button>
        </div>
      )}

      {step === "contact" && (
        <div className="space-y-4">
          <input
            placeholder={t.contact.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            placeholder={t.contact.phonePlaceholder}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            type="email"
            placeholder={t.contact.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
          />

          <button
            onClick={handleContactSubmit}
            disabled={loading || !name || !phone || !email}
            className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? dict.common.starting : dict.common.continue}
          </button>
        </div>
      )}

      {step === "phone" && (
        <div className="space-y-4">
          <p className="text-center text-sm text-zinc-500">{t.phone.compatibilityHint(productName)}</p>

          <input
            placeholder={t.phone.manufacturerPlaceholder}
            value={manufacturer}
            onChange={(e) => {
              setManufacturer(e.target.value);
              setPhoneCompatible(null);
            }}
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            placeholder={t.phone.modelPlaceholder}
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setPhoneCompatible(null);
            }}
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            placeholder={t.phone.variantPlaceholder}
            value={variant}
            onChange={(e) => {
              setVariant(e.target.value);
              setPhoneCompatible(null);
            }}
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
          />

          {phoneCompatible === true && (
            <p className="rounded-lg bg-green-50 p-3 text-center text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
              {t.phone.compatible}
            </p>
          )}
          {phoneCompatible === false && (
            <p className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {t.phone.incompatible(productName)}
            </p>
          )}

          {phoneCompatible !== true ? (
            <button
              onClick={handleCheckCompatibility}
              disabled={loading || !manufacturer || !model}
              className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {loading ? dict.common.checking : t.phone.checkCompatibility}
            </button>
          ) : (
            <button
              onClick={beginKyc}
              disabled={loading}
              className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {loading ? dict.common.starting : dict.common.continue}
            </button>
          )}
        </div>
      )}

      {step === "verify" && (
        <div className="space-y-4">
          <p className="text-center text-sm text-zinc-500">{t.verify.hint}</p>
          <button
            onClick={() => sessionUrl && verificationId && openDiditModal(sessionUrl, verificationId)}
            disabled={loading}
            className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {t.verify.start}
          </button>
          {process.env.NODE_ENV !== "production" && (
            <button
              onClick={skipVerificationForTesting}
              className="w-full rounded-full border border-dashed border-zinc-400 py-3 text-sm font-medium text-zinc-500"
            >
              {t.verify.skipDev}
            </button>
          )}
        </div>
      )}

      {step === "confirm" && selectedPackage && (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="font-medium">{selectedPackage.name}</p>
            <p className="text-sm text-zinc-500">{t.confirm.requestedPickup(formatDateTime(resolveEarliestStartTime(), locale))}</p>
            <p className="text-sm text-zinc-500">
              {t.confirm.pickup(lockerPartners.find((p) => p.id === pickupPartnerId)?.name ?? "—")}
              {dropoffPartnerId !== pickupPartnerId &&
                t.confirm.dropoffSuffix(lockerPartners.find((p) => p.id === dropoffPartnerId)?.name ?? "—")}
            </p>
            <p className="text-sm text-zinc-500">{t.confirm.rentalFee(selectedPackage.price_myr)}</p>
            <p className="text-sm text-zinc-500">{t.confirm.deposit(selectedPackage.deposit_myr)}</p>
          </div>

          {termsBody && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-200 p-3 text-xs text-zinc-500 dark:border-zinc-800">
              {termsBody}
            </div>
          )}

          <label className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
            <span>
              {t.confirm.agreementPrefix}
              <Link href="/terms" target="_blank" className="underline underline-offset-2">
                {dict.common.termsAndConditions}
              </Link>
              {t.confirm.agreementSuffix}
            </span>
          </label>

          <button
            onClick={handleConfirm}
            disabled={loading || !agreed}
            className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? t.confirm.reserving : t.confirm.continueToPayment}
          </button>
        </div>
      )}

      {step === "booked" && assignedTime && secureToken && (
        <div className="space-y-4">
          <p className="text-center text-sm text-zinc-500">{t.booked.notAvailable}</p>
          <div className="rounded-xl border border-zinc-200 p-4 text-center dark:border-zinc-800">
            <p className="font-medium">{formatDateTime(new Date(assignedTime.start), locale)}</p>
            <p className="text-sm text-zinc-500">{t.booked.until(formatDateTime(new Date(assignedTime.end), locale))}</p>
          </div>
          <button
            onClick={() => router.push(`/r/${secureToken}/deposit-notice`)}
            className="w-full rounded-full bg-black py-3 font-semibold text-white dark:bg-white dark:text-black"
          >
            {t.confirm.continueToPayment}
          </button>
        </div>
      )}
    </div>
  );
}

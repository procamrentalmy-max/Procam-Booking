"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DiditSdk } from "@didit-protocol/sdk-web";
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
  const dateInputRef = useRef<HTMLInputElement>(null);
  const daytimePackages = [...packages].filter((p) => !p.is_overnight).sort((a, b) => a.duration_minutes - b.duration_minutes);
  const overnightPackage = packages.find((p) => p.is_overnight) ?? null;

  const [step, setStep] = useState<Step>("package");
  const [mode, setMode] = useState<"daytime" | "overnight">(daytimePackages.length > 0 ? "daytime" : "overnight");
  const initialDefault = defaultDateAndHour();
  const [date, setDate] = useState(initialDefault.date);
  const [startHour, setStartHour] = useState<number | null>(null);
  const [endHour, setEndHour] = useState<number | null>(null);
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
  const selectedPackage = mode === "overnight" ? (overnightPackage ?? undefined) : daytimeSelectedPackage;
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

  function selectMode(next: "daytime" | "overnight") {
    setMode(next);
    setStartHour(null);
    setEndHour(null);
  }

  /**
   * One shared set of hour slots for both ends of the range: the first tap
   * (or a tap once a range is already complete) sets the start; a second
   * tap on a later hour sets the end; a tap on an earlier hour restarts the
   * range from there instead.
   */
  function tapHour(h: number) {
    if (isHourUnavailable(h)) return;
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
          const confirm = await confirmKycAction({ verificationId: verifId, partnerId: pickupPartnerId });
          if (confirm.verified) {
            setStep("confirm");
          } else {
            setError("We couldn't approve your verification. Please try again.");
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
          setLoading(false);
        }
      } else if (result.type === "cancelled") {
        // Nothing to do — the wizard's "verify" step is still showing underneath, ready to try again.
      } else {
        setError(result.error?.message ?? "Verification failed. Please try again.");
      }
    };
    DiditSdk.shared.startVerification({ url });
  }

  async function skipVerificationForTesting() {
    if (!verificationId) return;
    setLoading(true);
    setError(null);
    try {
      await devSkipKycAction({ verificationId, partnerId: pickupPartnerId });
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function beginKyc() {
    setLoading(true);
    setError(null);
    try {
      const result = await startKycAction({ name, phone, email, partnerId: pickupPartnerId });
      setCustomerId(result.customerId);
      setVerificationId(result.verificationId);
      setSessionUrl(result.sessionUrl);
      // KYC_BYPASS_ENABLED: startKycAction already marked this VERIFIED and skipped Didit — nothing to show, go straight through.
      setStep(result.sessionUrl ? "verify" : "confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handlePackageSubmit() {
    setError(null);
    if (!packageId) {
      setError("Select a rental package.");
      return;
    }
    if (resolveEarliestStartTime().getTime() < Date.now() + MIN_LEAD_MINUTES * 60_000 - 60_000) {
      const hours = MIN_LEAD_MINUTES / 60;
      setError(`Bookings need at least ${hours} hour${hours === 1 ? "" : "s"} of notice — please choose a later time.`);
      return;
    }
    setStep("locations");
  }

  function handleLocationsSubmit() {
    setError(null);
    if (!pickupPartnerId || !dropoffPartnerId) {
      setError("Select a pickup and a dropoff location.");
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
      setError(err instanceof Error ? err.message : "Something went wrong.");
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
        router.push(`/r/${result.secureToken}/pay`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <h1 className="text-center text-xl font-semibold text-black dark:text-zinc-50">
        {step === "package" && productName}
        {step === "locations" && "Pickup & Dropoff"}
        {step === "contact" && "Your Details"}
        {step === "phone" && "Check Your Phone"}
        {step === "verify" && "Verify Your Identity"}
        {step === "confirm" && "Confirm Booking"}
        {step === "booked" && "Booking Confirmed"}
      </h1>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      {step === "package" && (
        <div className="space-y-5">
          {/* Price chart — reference only; the actual pick happens in the timetable below. Full list, no scrolling. */}
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900">
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">Duration</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-500">Price</th>
                </tr>
              </thead>
              <tbody>
                {[...daytimePackages, ...(overnightPackage ? [overnightPackage] : [])].map((pkg) => (
                  <tr key={pkg.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-2">{pkg.name}</td>
                    <td className="px-4 py-2 text-right font-semibold">RM{pkg.price_myr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {daytimePackages.length > 0 && overnightPackage && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => selectMode("daytime")}
                className={`flex-1 rounded-full border py-2 text-sm font-medium ${
                  mode === "daytime"
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                Daytime
              </button>
              <button
                type="button"
                onClick={() => selectMode("overnight")}
                className={`flex-1 rounded-full border py-2 text-sm font-medium ${
                  mode === "overnight"
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                Overnight
              </button>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs text-zinc-500">
              {mode === "overnight"
                ? "Pick up at 10pm, return by 8am — bookings need at least 2 hours of notice."
                : "Pick a date, then a start time and an end time from the timetable — bookings need at least 2 hours of notice. If your exact slot isn't free, we'll offer the next available one."}
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

            {mode === "daytime" && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                  {startHour === null
                    ? "Tap a start time"
                    : endHour === null
                      ? "Now tap an end time"
                      : "Tap any time to start over"}
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
            Continue
          </button>
        </div>
      )}

      {step === "locations" && (
        <div className="space-y-4">
          <p className="text-center text-sm text-zinc-500">
            Pick up and drop off at the same spot, or choose different locations for a one-way rental.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-zinc-400">Pickup</label>
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
            <label className="text-xs font-medium uppercase tracking-wide text-zinc-400">Dropoff</label>
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
            Continue
          </button>
        </div>
      )}

      {step === "contact" && (
        <div className="space-y-4">
          <input
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            placeholder="Phone number, with country code, e.g. +60123456789"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
          />

          <button
            onClick={handleContactSubmit}
            disabled={loading || !name || !phone || !email}
            className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? "Starting…" : "Continue"}
          </button>
        </div>
      )}

      {step === "phone" && (
        <div className="space-y-4">
          <p className="text-center text-sm text-zinc-500">
            {productName} works with your own phone — let&apos;s check it&apos;s compatible before you continue.
          </p>

          <input
            placeholder="Manufacturer, e.g. Apple"
            value={manufacturer}
            onChange={(e) => {
              setManufacturer(e.target.value);
              setPhoneCompatible(null);
            }}
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            placeholder="Model, e.g. iPhone 16 Pro Max"
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setPhoneCompatible(null);
            }}
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            placeholder="Variant (optional)"
            value={variant}
            onChange={(e) => {
              setVariant(e.target.value);
              setPhoneCompatible(null);
            }}
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
          />

          {phoneCompatible === true && (
            <p className="rounded-lg bg-green-50 p-3 text-center text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
              Your phone is compatible.
            </p>
          )}
          {phoneCompatible === false && (
            <p className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              We can&apos;t confirm this phone works with {productName}. Please try a different phone — we
              can&apos;t book this rental with an unconfirmed fit.
            </p>
          )}

          {phoneCompatible !== true ? (
            <button
              onClick={handleCheckCompatibility}
              disabled={loading || !manufacturer || !model}
              className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {loading ? "Checking…" : "Check Compatibility"}
            </button>
          ) : (
            <button
              onClick={beginKyc}
              disabled={loading}
              className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {loading ? "Starting…" : "Continue"}
            </button>
          )}
        </div>
      )}

      {step === "verify" && (
        <div className="space-y-4">
          <p className="text-center text-sm text-zinc-500">
            Verify your identity to continue — you&apos;ll photograph your ID and take a quick selfie.
          </p>
          <button
            onClick={() => sessionUrl && verificationId && openDiditModal(sessionUrl, verificationId)}
            disabled={loading}
            className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Start Verification
          </button>
          {process.env.NODE_ENV !== "production" && (
            <button
              onClick={skipVerificationForTesting}
              className="w-full rounded-full border border-dashed border-zinc-400 py-3 text-sm font-medium text-zinc-500"
            >
              Skip Verification (dev only)
            </button>
          )}
        </div>
      )}

      {step === "confirm" && selectedPackage && (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="font-medium">{selectedPackage.name}</p>
            <p className="text-sm text-zinc-500">Requested pickup: {resolveEarliestStartTime().toLocaleString()}</p>
            <p className="text-sm text-zinc-500">
              Pickup: {lockerPartners.find((p) => p.id === pickupPartnerId)?.name ?? "—"}
              {dropoffPartnerId !== pickupPartnerId && (
                <> — Dropoff: {lockerPartners.find((p) => p.id === dropoffPartnerId)?.name ?? "—"}</>
              )}
            </p>
            <p className="text-sm text-zinc-500">Rental fee: RM{selectedPackage.price_myr}</p>
            <p className="text-sm text-zinc-500">Refundable security deposit: RM{selectedPackage.deposit_myr}</p>
          </div>

          {termsBody && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-200 p-3 text-xs text-zinc-500 dark:border-zinc-800">
              {termsBody}
            </div>
          )}

          <label className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
            <span>
              I agree to the ProCam rental terms above, including responsibility for the equipment and
              accessories until returned and inspected, and to the full{" "}
              <Link href="/terms" target="_blank" className="underline underline-offset-2">
                Terms &amp; Conditions
              </Link>
              .
            </span>
          </label>

          <button
            onClick={handleConfirm}
            disabled={loading || !agreed}
            className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? "Reserving…" : "Continue to Payment"}
          </button>
        </div>
      )}

      {step === "booked" && assignedTime && secureToken && (
        <div className="space-y-4">
          <p className="text-center text-sm text-zinc-500">
            Your requested hour wasn&apos;t available, so we&apos;ve booked you the next open slot instead:
          </p>
          <div className="rounded-xl border border-zinc-200 p-4 text-center dark:border-zinc-800">
            <p className="font-medium">{new Date(assignedTime.start).toLocaleString()}</p>
            <p className="text-sm text-zinc-500">until {new Date(assignedTime.end).toLocaleString()}</p>
          </div>
          <button
            onClick={() => router.push(`/r/${secureToken}/pay`)}
            className="w-full rounded-full bg-black py-3 font-semibold text-white dark:bg-white dark:text-black"
          >
            Continue to Payment
          </button>
        </div>
      )}
    </div>
  );
}

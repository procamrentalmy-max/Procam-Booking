"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startVerificationAction, verifyOtpAction, createBookingAction, checkPhoneCompatibilityAction } from "./actions";

type RentalPackage = {
  id: string;
  name: string;
  price_myr: number;
  deposit_myr: number;
  duration_minutes: number;
  is_overnight: boolean;
};

type Step = "details" | "phone" | "otp" | "confirm" | "booked";

/** 8am-7pm — matches the locker network's operating hours; the server is the real authority on what's actually feasible. */
const OPERATING_HOURS = Array.from({ length: 12 }, (_, i) => i + 8);
const MIN_LEAD_MINUTES = 60;

function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  termsVersionId,
  termsBody,
}: {
  partnerId: string;
  referralCode: string;
  productId: string;
  productName: string;
  requiresPhoneCompatibility: boolean;
  packages: RentalPackage[];
  termsVersionId: string | null;
  termsBody: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const initialDefault = defaultDateAndHour();
  const [date, setDate] = useState(initialDefault.date);
  const [hour, setHour] = useState(initialDefault.hour);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [variant, setVariant] = useState("");
  const [phoneCompatible, setPhoneCompatible] = useState<boolean | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [secureToken, setSecureToken] = useState<string | null>(null);
  const [assignedTime, setAssignedTime] = useState<{ start: string; end: string } | null>(null);

  const selectedPackage = packages.find((p) => p.id === packageId);

  /** Computed fresh at submit time — the server is the real authority; this is what we're requesting, not a guarantee. */
  function resolveEarliestStartTime(): Date {
    if (selectedPackage?.is_overnight) {
      const combined = new Date(`${date}T22:00`);
      return Number.isNaN(combined.getTime()) ? new Date() : combined;
    }
    const combined = new Date(`${date}T${String(hour).padStart(2, "0")}:00`);
    return Number.isNaN(combined.getTime()) ? new Date() : combined;
  }

  async function sendVerificationCode() {
    setLoading(true);
    try {
      const result = await startVerificationAction({ name, phone, email });
      setCustomerId(result.customerId);
      setVerificationId(result.verificationId);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDetailsSubmit() {
    setError(null);
    if (!packageId) {
      setError("Select a rental package.");
      return;
    }
    if (resolveEarliestStartTime().getTime() < Date.now() + MIN_LEAD_MINUTES * 60_000 - 60_000) {
      setError(`Bookings need at least ${MIN_LEAD_MINUTES / 60} hour of notice — please choose a later time.`);
      return;
    }

    if (requiresPhoneCompatibility) {
      setStep("phone");
      return;
    }
    await sendVerificationCode();
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

  async function handleOtpSubmit() {
    if (!verificationId) return;
    setError(null);
    setLoading(true);
    try {
      await verifyOtpAction({ verificationId, code: otpCode });
      setStep("confirm");
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
        partnerId,
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
        {step === "details" && productName}
        {step === "phone" && "Check Your Phone"}
        {step === "otp" && "Verify Your Phone"}
        {step === "confirm" && "Confirm Booking"}
        {step === "booked" && "Booking Confirmed"}
      </h1>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      {step === "details" && (
        <div className="space-y-4">
          <div className="space-y-2">
            {packages.map((pkg) => (
              <label
                key={pkg.id}
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 ${
                  packageId === pkg.id
                    ? "border-black dark:border-white"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <span>
                  <input
                    type="radio"
                    name="package"
                    className="mr-2"
                    checked={packageId === pkg.id}
                    onChange={() => setPackageId(pkg.id)}
                  />
                  {pkg.name}
                </span>
                <span className="font-semibold">RM{pkg.price_myr}</span>
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs text-zinc-500">
              {selectedPackage?.is_overnight
                ? "Pick up at 10pm, return by 8am — bookings need at least 1 hour of notice."
                : "Pick a pickup date and hour — bookings need at least 1 hour of notice. If your exact hour isn't free, we'll offer the next available one."}
            </p>
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                min={toDateInputValue(new Date())}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
              />
              {!selectedPackage?.is_overnight && (
                <select
                  value={hour}
                  onChange={(e) => setHour(Number(e.target.value))}
                  className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {OPERATING_HOURS.map((h) => (
                    <option key={h} value={h}>
                      {formatHour(h)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

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
            onClick={handleDetailsSubmit}
            disabled={loading || !name || !phone || !email}
            className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? "Sending code…" : "Continue"}
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
              onClick={sendVerificationCode}
              disabled={loading}
              className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {loading ? "Sending code…" : "Continue"}
            </button>
          )}
        </div>
      )}

      {step === "otp" && (
        <div className="space-y-4">
          <p className="text-center text-sm text-zinc-500">We sent a 6-digit code to your WhatsApp, {phone}.</p>
          <input
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-center text-2xl tracking-widest dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            onClick={handleOtpSubmit}
            disabled={loading || otpCode.length !== 6}
            className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? "Verifying…" : "Verify"}
          </button>
        </div>
      )}

      {step === "confirm" && selectedPackage && (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="font-medium">{selectedPackage.name}</p>
            <p className="text-sm text-zinc-500">Requested pickup: {resolveEarliestStartTime().toLocaleString()}</p>
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
            I agree to the ProCam rental terms above, including responsibility for the equipment and accessories
            until returned and inspected.
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

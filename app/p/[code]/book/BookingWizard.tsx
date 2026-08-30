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
};

type Step = "details" | "phone" | "otp" | "confirm";

function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toTimeInputValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
  const [startNow, setStartNow] = useState(true);
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [time, setTime] = useState(() => toTimeInputValue(new Date()));
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

  const selectedPackage = packages.find((p) => p.id === packageId);

  /** Computed fresh at submit time — "now" shouldn't freeze at whatever moment the toggle was clicked. */
  function resolveStartTime(): Date {
    if (startNow) return new Date();
    const combined = new Date(`${date}T${time}`);
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
    if (!startNow && resolveStartTime().getTime() < Date.now() - 60_000) {
      setError("Please choose a time in the future.");
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
      const result = await createBookingAction({
        customerId,
        verificationId,
        partnerId,
        rentalPackageId: packageId,
        referralCode,
        startTime: resolveStartTime().toISOString(),
        termsVersionId,
      });
      router.push(`/r/${result.secureToken}/pay`);
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
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStartNow(true)}
                className={`flex-1 rounded-full border py-2.5 text-sm font-medium ${
                  startNow
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                Start Now
              </button>
              <button
                type="button"
                onClick={() => setStartNow(false)}
                className={`flex-1 rounded-full border py-2.5 text-sm font-medium ${
                  !startNow
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                Choose a Time
              </button>
            </div>

            {!startNow && (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={date}
                  min={toDateInputValue(new Date())}
                  onChange={(e) => setDate(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
                />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            )}
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
              We can&apos;t confirm this phone works with {productName}. Please ask reception or try a different
              phone — we can&apos;t book this rental with an unconfirmed fit.
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
            <p className="text-sm text-zinc-500">
              Pickup: {startNow ? "Now" : resolveStartTime().toLocaleString()}
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
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startVerificationAction, verifyOtpAction, createBookingAction } from "./actions";

type RentalPackage = {
  id: string;
  name: string;
  price_myr: number;
  deposit_myr: number;
  duration_minutes: number;
};

type Step = "details" | "otp" | "confirm";

export function BookingWizard({
  partnerId,
  referralCode,
  packages,
  initialPackageId,
}: {
  partnerId: string;
  referralCode: string;
  packages: RentalPackage[];
  initialPackageId?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");
  const [packageId, setPackageId] = useState(initialPackageId ?? packages[0]?.id ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedPackage = packages.find((p) => p.id === packageId);

  async function handleDetailsSubmit() {
    setError(null);
    if (!packageId) {
      setError("Select a rental package.");
      return;
    }
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
        {step === "details" && "Your Details"}
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
            <p className="text-sm text-zinc-500">Rental fee: RM{selectedPackage.price_myr}</p>
            <p className="text-sm text-zinc-500">Refundable security deposit: RM{selectedPackage.deposit_myr}</p>
          </div>

          <label className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
            I agree to the ProCam rental terms, including responsibility for the camera and accessories until
            returned and inspected.
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

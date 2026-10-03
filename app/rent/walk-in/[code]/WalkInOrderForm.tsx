"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import {
  BATTERY_FLIGHT_LABEL,
  BATTERY_OPTIONS,
  BATTERY_PACKAGE_FEE_MYR,
  DEFAULT_BATTERIES,
  DEPOSIT_MYR,
  HOURLY_RATE_MYR,
  formatMyr,
  rentalFeeMyr,
  type BatteryCount,
} from "@/lib/droneRental/pricingRules";
import { submitWalkInOrderAction } from "./actions";

const selectedClass = "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black";
const idleClass = "border-zinc-300 dark:border-zinc-700";

export function WalkInOrderForm({ code, durationsMinutes }: { code: string; durationsMinutes: number[] }) {
  const router = useRouter();
  const [durationMinutes, setDurationMinutes] = useState(durationsMinutes[0] ?? 60);
  const [batteries, setBatteries] = useState<BatteryCount>(DEFAULT_BATTERIES);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    const result = await submitWalkInOrderAction({ code, durationMinutes, batteries, name, phone, email });
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
      <div>
        <p className="mb-2 text-sm font-medium">How long do you need it?</p>
        <div className={`grid gap-2 ${durationsMinutes.length > 3 ? "grid-cols-4" : "grid-cols-3"}`}>
          {durationsMinutes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setDurationMinutes(m)}
              aria-pressed={durationMinutes === m}
              className={`rounded-xl border py-3 text-center ${durationMinutes === m ? selectedClass : idleClass}`}
            >
              <span className="block text-sm font-semibold">{m / 60}h</span>
              <span className={`block text-xs ${durationMinutes === m ? "opacity-80" : "text-zinc-500"}`}>{formatMyr((m / 60) * HOURLY_RATE_MYR)}</span>
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
                {n} {n === 1 ? "battery" : "batteries"} · {formatMyr(BATTERY_PACKAGE_FEE_MYR[n])}
              </span>
              <span className={`block text-xs ${batteries === n ? "opacity-80" : "text-zinc-500"}`}>about {BATTERY_FLIGHT_LABEL[n]} min of flying</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">Your hours are time with the drone, not flying time.</p>
      </div>

      <div className="space-y-1 rounded-2xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Rental fee</span>
          <span className="font-semibold">{formatMyr(rentalFeeMyr(durationMinutes, batteries))}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Deposit, held on your card</span>
          <span className="font-medium">{formatMyr(DEPOSIT_MYR)}</span>
        </div>
        <p className="pt-1 text-xs text-zinc-400">The deposit is only a hold. It&apos;s released when you return everything in good condition.</p>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Your details</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="name" required className={`w-full ${inputClass} py-3 text-base`} />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
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
      </div>

      {error && (
        <p role="alert" className="text-center text-sm text-red-600">
          {error}
        </p>
      )}
      <button type="submit" disabled={loading || !name || !phone || !email} className={`w-full ${primaryButtonClass} h-12 rounded-full text-base disabled:opacity-50`}>
        {loading ? "Sending…" : "Send my order to the shop"}
      </button>
      <p className="text-center text-xs text-zinc-400">The staff confirm your order, then you pay on this phone.</p>
    </form>
  );
}

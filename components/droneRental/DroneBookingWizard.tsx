"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import { FIRST_HOUR_RATE_MYR, ADDITIONAL_HOUR_RATE_MYR, BATTERIES_INCLUDED, BATTERY_SWAP_FEE_MYR, DEPOSIT_MYR, rentalFeeMyr } from "@/lib/droneRental/pricingRules";
import { getUnavailableDroneStartsAction, createDroneBookingAction } from "@/app/rent/[shopId]/actions";

/**
 * Placeholder shop hours — no operating-hours requirement was specified for
 * this vertical; matches ProCam's own 9am-8pm default closely enough to
 * launch with. Trivial to change once real hours are confirmed.
 */
const OPERATING_HOUR_START = 8;
const OPERATING_HOUR_END = 22;
const SLOT_MINUTES = 30;
const DURATION_OPTIONS_HOURS = [1, 2, 3, 4, 5, 6];

function alignToNextInterval(date: Date): Date {
  const d = new Date(date);
  d.setSeconds(0, 0);
  const rem = d.getMinutes() % SLOT_MINUTES;
  if (rem !== 0) d.setMinutes(d.getMinutes() + (SLOT_MINUTES - rem));
  return d;
}

/** Client-side only, for display/candidate generation — the server (findNextAvailableSlot) is the real authority on what's actually feasible. */
function generateSlotStarts(now: Date): Date[] {
  const nextSlot = alignToNextInterval(now);
  const todayOpen = new Date(now);
  todayOpen.setHours(OPERATING_HOUR_START, 0, 0, 0);
  const todayClose = new Date(now);
  todayClose.setHours(OPERATING_HOUR_END, 0, 0, 0);

  let dayStart = nextSlot < todayOpen ? todayOpen : nextSlot;
  let dayClose = todayClose;
  if (dayStart >= todayClose) {
    dayStart = new Date(todayOpen);
    dayStart.setDate(dayStart.getDate() + 1);
    dayClose = new Date(todayClose);
    dayClose.setDate(dayClose.getDate() + 1);
  }

  const slots: Date[] = [];
  for (let t = new Date(dayStart); t < dayClose; t = new Date(t.getTime() + SLOT_MINUTES * 60_000)) {
    slots.push(new Date(t));
  }
  return slots;
}

type Step = "duration" | "slot" | "contact" | "booked";

export function DroneBookingWizard({ shopId }: { shopId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("duration");
  const [durationHours, setDurationHours] = useState(1);
  const [slots, setSlots] = useState<Date[]>([]);
  const [unavailable, setUnavailable] = useState<Set<number> | null>(null);
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const durationMinutes = durationHours * 60;
  const rentalFee = rentalFeeMyr(durationMinutes);

  // Regenerate the candidate grid whenever duration changes (or on first
  // entering the slot step) and re-check availability against it.
  useEffect(() => {
    if (step !== "slot") return;
    const candidates = generateSlotStarts(new Date());
    setSlots(candidates);
    setUnavailable(null);
    let cancelled = false;
    getUnavailableDroneStartsAction({ shopId, durationMinutes, starts: candidates.map((d) => d.toISOString()) })
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
  }, [step, shopId, durationMinutes]);

  async function submit() {
    if (!selectedStart) return;
    setLoading(true);
    setError(null);
    try {
      const result = await createDroneBookingAction({
        shopId,
        durationMinutes,
        startTime: selectedStart.toISOString(),
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
        <div className="rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <p>DJI Neo 2 Fly More Combo</p>
          <p className="mt-1 text-zinc-500">
            RM{FIRST_HOUR_RATE_MYR} first hour ({BATTERIES_INCLUDED} batteries included) · RM{ADDITIONAL_HOUR_RATE_MYR}/hour after · RM{DEPOSIT_MYR} refundable deposit
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Need more flight time mid-rental? Swap for a fresh battery at the shop for RM{BATTERY_SWAP_FEE_MYR} each.
          </p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">How many hours?</p>
          <div className="grid grid-cols-3 gap-2">
            {DURATION_OPTIONS_HOURS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setDurationHours(h)}
                className={`rounded-lg border py-3 text-sm font-medium ${
                  durationHours === h ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-sm text-zinc-500">Rental fee: RM{rentalFee}</p>

        <button type="button" onClick={() => setStep("slot")} className={`w-full ${primaryButtonClass} h-12 rounded-full`}>
          Choose a time
        </button>
      </div>
    );
  }

  if (step === "slot") {
    return (
      <div className="space-y-4">
        <Link href="/rent" className="block text-center text-sm text-zinc-500 underline underline-offset-2">
          Don&apos;t see a time you like? Choose another shop
        </Link>

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
                className={`rounded-lg border py-2 text-sm ${
                  isSelected
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : isUnavailable
                      ? "cursor-not-allowed border-zinc-100 text-zinc-300 line-through dark:border-zinc-900 dark:text-zinc-700"
                      : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                {formatMalaysiaTime(s, "en").split(", ").pop()}
              </button>
            );
          })}
        </div>
        {unavailable === null && <p className="text-center text-xs text-zinc-400">Checking availability…</p>}

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

  if (step === "contact") {
    return (
      <div className="space-y-4">
        {selectedStart && (
          <p className="text-center text-sm text-zinc-500">
            {durationHours}h starting {formatMalaysiaTime(selectedStart, "en")} · RM{rentalFee} + RM{DEPOSIT_MYR} deposit
          </p>
        )}
        <div className="space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={`w-full ${inputClass}`} />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className={`w-full ${inputClass}`} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className={`w-full ${inputClass}`} />
        </div>
        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={loading || !name || !phone || !email}
          onClick={submit}
          className={`w-full ${primaryButtonClass} h-12 rounded-full disabled:opacity-50`}
        >
          {loading ? "Booking…" : "Book & pay"}
        </button>
      </div>
    );
  }

  return null;
}

"use client";

import { useState } from "react";
import { lookupBookingForPickupAction, markHandedOverAction, type PickupLookupResult } from "./actions";
import { inputClass, primaryButtonClass } from "@/components/formStyles";

export default function ReceptionPickupPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<PickupLookupResult | null>(null);
  const [handedOver, setHandedOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLookup() {
    setError(null);
    setResult(null);
    setHandedOver(false);
    setLoading(true);
    try {
      setResult(await lookupBookingForPickupAction(code));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleHandOver() {
    if (!result?.valid) return;
    setLoading(true);
    try {
      await markHandedOverAction(result.bookingId);
      setHandedOver(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Booking code, e.g. BKG-00001"
          className={`${inputClass} flex-1 text-lg`}
        />
        <button onClick={handleLookup} disabled={loading || !code} className={primaryButtonClass}>
          Look Up
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && !result.valid && (
        <p className="rounded-xl border border-red-200 p-4 text-center text-red-600">
          No booking ready for pickup with that code.
        </p>
      )}

      {result?.valid && (
        <div className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-center text-lg font-semibold text-green-600">BOOKING VERIFIED</p>
          <p className="text-center text-sm text-zinc-500">Customer: {result.customerName}</p>
          <div className="rounded-xl bg-zinc-100 p-4 text-center dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Hand Over</p>
            <p className="text-2xl font-bold">{result.cameraHumanId}</p>
            <p className="text-lg">{result.kitHumanId}</p>
          </div>

          {handedOver ? (
            <p className="text-center text-sm font-medium text-green-600">Handed over ✓</p>
          ) : (
            <button onClick={handleHandOver} disabled={loading} className={`${primaryButtonClass} w-full`}>
              Mark Handed Over
            </button>
          )}
        </div>
      )}
    </div>
  );
}

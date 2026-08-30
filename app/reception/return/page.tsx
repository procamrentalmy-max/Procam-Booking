"use client";

import { useState } from "react";
import { lookupBookingForReturnAction, markReturnReceivedAction, type ReturnLookupResult } from "./actions";
import { inputClass, primaryButtonClass } from "@/components/formStyles";

export default function ReceptionReturnPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ReturnLookupResult | null>(null);
  const [received, setReceived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLookup() {
    setError(null);
    setResult(null);
    setReceived(false);
    setLoading(true);
    try {
      setResult(await lookupBookingForReturnAction(code));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReceive() {
    if (!result?.valid) return;
    setLoading(true);
    try {
      await markReturnReceivedAction(result.bookingId);
      setReceived(true);
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
          No booking awaiting return with that code.
        </p>
      )}

      {result?.valid && (
        <div className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-center text-lg font-semibold text-green-600">BOOKING VERIFIED</p>
          <p className="text-center text-sm text-zinc-500">Customer: {result.customerName}</p>
          <div className="rounded-xl bg-zinc-100 p-4 text-center dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Receive</p>
            <p className="text-2xl font-bold">{result.assetHumanId}</p>
            <p className="text-lg">{result.kitHumanId}</p>
          </div>

          {received ? (
            <p className="text-center text-sm font-medium text-green-600">Received ✓ — awaiting ProCam inspection</p>
          ) : (
            <button onClick={handleReceive} disabled={loading} className={`${primaryButtonClass} w-full`}>
              Confirm Received
            </button>
          )}
        </div>
      )}
    </div>
  );
}

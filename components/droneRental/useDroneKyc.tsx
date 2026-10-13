"use client";

import { useState, type ReactNode } from "react";
import { DiditSdk } from "@didit-protocol/sdk-web";
import { confirmDroneKycAction, devSkipDroneKycAction, startDroneKycAction } from "@/app/rent/kycActions";
import { primaryButtonClass } from "@/components/formStyles";

type Pending = { verificationId: string; sessionUrl: string };

/**
 * The ID check for a drone rental. `verifyThen` starts it; when it has passed (at once in local development, otherwise after the
 * customer completes Didit's window), `proceed` is called with the check's id. While the customer still has to do the check,
 * `panel` is what to show instead of the submit button.
 */
export function useDroneKyc() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [onPassed, setOnPassed] = useState<((verificationId: string) => Promise<void>) | null>(null);

  async function verifyThen(details: { name: string; phone: string; email: string }, proceed: (verificationId: string) => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      const start = await startDroneKycAction(details);
      if (start.verified) {
        await proceed(start.verificationId);
        return;
      }
      setPending({ verificationId: start.verificationId, sessionUrl: start.sessionUrl });
      // Held in state as a function-returning-function so React doesn't call it.
      setOnPassed(() => proceed);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function passed(verificationId: string) {
    if (!onPassed) return;
    setBusy(true);
    try {
      await onPassed(verificationId);
    } finally {
      setBusy(false);
    }
  }

  function openDidit() {
    if (!pending) return;
    const { verificationId, sessionUrl } = pending;
    DiditSdk.shared.onComplete = async (result) => {
      if (result.type === "completed") {
        try {
          const confirmed = await confirmDroneKycAction(verificationId);
          if (confirmed.verified) {
            setPending(null);
            await passed(verificationId);
          } else {
            setMessage("We couldn't approve your ID. Please try again with a clear photo of your ID and your face in good light.");
          }
        } catch (err) {
          setMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
        }
      } else if (result.type !== "cancelled") {
        setMessage(result.error?.message ?? "The ID check didn't finish. Please try again.");
      }
    };
    DiditSdk.shared.startVerification({ url: sessionUrl });
  }

  async function skipForTesting() {
    if (!pending) return;
    setBusy(true);
    try {
      await devSkipDroneKycAction(pending.verificationId);
      const id = pending.verificationId;
      setPending(null);
      await passed(id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const panel: ReactNode = pending ? (
    <div className="space-y-3 rounded-2xl border border-zinc-200 p-4 text-center dark:border-zinc-800">
      <p className="text-base font-semibold text-black dark:text-zinc-50">Verify your ID</p>
      <p className="text-sm text-zinc-500">
        Before we hold a drone for you, we check it&apos;s really you: a photo of your MyKad or passport and a quick selfie. It takes about a minute.
      </p>
      <button type="button" onClick={openDidit} disabled={busy} className={`w-full ${primaryButtonClass} h-12 rounded-full disabled:opacity-50`}>
        Verify my ID
      </button>
      {process.env.NODE_ENV !== "production" && (
        <button type="button" onClick={skipForTesting} disabled={busy} className="w-full rounded-full border border-dashed border-zinc-400 py-3 text-sm font-medium text-zinc-500">
          [DEV] Skip ID check
        </button>
      )}
    </div>
  ) : null;

  return { verifyThen, panel, kycBusy: busy, kycMessage: message, kycPending: pending !== null };
}

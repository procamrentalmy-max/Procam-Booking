"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CameraCaptureField } from "@/components/CameraCaptureField";
import { en } from "@/lib/i18n/dictionaries/en";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { DEPOSIT_MYR, DAMAGE_DEDUCTION_MYR, LOSS_DEDUCTION_MYR } from "@/lib/droneRental/pricingRules";
import { submitReturnAction } from "./actions";

type Outcome = "NONE" | "DAMAGED" | "LOST";

const OUTCOMES: { value: Outcome; label: string; hint: string }[] = [
  { value: "NONE", label: "All good", hint: `Full RM${DEPOSIT_MYR} deposit released` },
  { value: "DAMAGED", label: "Damaged", hint: `RM${DAMAGE_DEDUCTION_MYR} kept from deposit` },
  { value: "LOST", label: "Lost", hint: `Full RM${LOSS_DEDUCTION_MYR} deposit kept` },
];

export function ReturnForm({
  bookingId,
  checklistItems,
  disabled,
}: {
  bookingId: string;
  checklistItems: { item_key: string; label: string }[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState<File[]>([]);
  const [acks, setAcks] = useState<Record<string, boolean>>(() => Object.fromEntries(checklistItems.map((i) => [i.item_key, false])));
  const [outcome, setOutcome] = useState<Outcome>("NONE");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [completedLateFee, setCompletedLateFee] = useState<number | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("bookingId", bookingId);
      formData.set("outcome", outcome);
      formData.set("acknowledgements", JSON.stringify(acks));
      formData.set("notes", notes);
      for (const p of photos) formData.append("photos", p);
      const result = await submitReturnAction(formData);
      if (result.lateFeeMyr > 0) {
        // Pause on a confirmation screen instead of auto-redirecting — the
        // merchant needs to actually see a late fee was charged, not have
        // it flash by.
        setCompletedLateFee(result.lateFeeMyr);
        setLoading(false);
        return;
      }
      router.push("/merchant");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  if (completedLateFee !== null) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Return completed. This drone came back late — RM{completedLateFee} was charged to the customer&apos;s saved card.
        </p>
        <button
          type="button"
          onClick={() => {
            router.push("/merchant");
            router.refresh();
          }}
          className={`w-full ${primaryButtonClass} h-12 rounded-full`}
        >
          Done
        </button>
      </div>
    );
  }

  if (disabled) {
    return <p className="text-center text-sm text-zinc-400">This booking isn&apos;t currently active.</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium">Condition photos</p>
        <CameraCaptureField dict={en} photos={photos} onChange={setPhotos} multiple />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Return checklist</p>
        {checklistItems.map((item) => (
          <label key={item.item_key} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={acks[item.item_key] ?? false}
              onChange={(e) => setAcks((prev) => ({ ...prev, [item.item_key]: e.target.checked }))}
              className="mt-1"
            />
            {item.label}
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Deposit outcome</p>
        {OUTCOMES.map((o) => (
          <label key={o.value} className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <span className="flex items-center gap-2">
              <input type="radio" name="outcome" checked={outcome === o.value} onChange={() => setOutcome(o.value)} />
              {o.label}
            </span>
            <span className="text-xs text-zinc-500">{o.hint}</span>
          </label>
        ))}
      </div>

      {outcome !== "NONE" && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What happened? (kept on file)"
          className={`w-full ${inputClass}`}
          rows={3}
        />
      )}

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <button type="button" disabled={loading || photos.length === 0} onClick={submit} className={`w-full ${primaryButtonClass} h-12 rounded-full disabled:opacity-50`}>
        {loading ? "Completing…" : "Complete return"}
      </button>
    </div>
  );
}

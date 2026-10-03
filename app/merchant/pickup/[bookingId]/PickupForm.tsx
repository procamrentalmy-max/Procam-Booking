"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CameraCaptureField } from "@/components/CameraCaptureField";
import { en } from "@/lib/i18n/dictionaries/en";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import { submitPickupAction, type PickupResult } from "./actions";

export function PickupForm({
  bookingId,
  checklistItems,
  disabled,
  batteriesCount,
}: {
  batteriesCount: number;
  bookingId: string;
  checklistItems: { item_key: string; label: string }[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState<File[]>([]);
  const [acks, setAcks] = useState<Record<string, boolean>>(() => Object.fromEntries(checklistItems.map((i) => [i.item_key, false])));
  const [customerSignedName, setCustomerSignedName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shortened, setShortened] = useState<PickupResult | null>(null);

  const allChecked = checklistItems.every((i) => acks[i.item_key]);
  const canSubmit = !disabled && photos.length > 0 && allChecked && customerSignedName.trim().length > 0;

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("bookingId", bookingId);
      formData.set("customerSignedName", customerSignedName);
      formData.set("acknowledgements", JSON.stringify(acks));
      for (const p of photos) formData.append("photos", p);
      const result = await submitPickupAction(formData);
      // Almost always straight back to the dashboard. If a following booking forced the rental to be shorter
      // than the customer paid for, the merchant needs to see that and tell them before they leave.
      if (result.shortenedByMinutes > 0) {
        setShortened(result);
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

  if (shortened) {
    return (
      <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <p className="font-semibold">Handover recorded. Tell the customer the return time.</p>
        <p className="text-sm">
          Another booking follows this one, so the rental is {shortened.shortenedByMinutes} minutes shorter than they paid for. They must return everything by{" "}
          <span className="font-semibold">{formatMalaysiaTime(new Date(shortened.returnBy), "en").split(", ").pop()}</span>.
        </p>
        <button
          type="button"
          onClick={() => {
            router.push("/merchant");
            router.refresh();
          }}
          className={`w-full ${primaryButtonClass} h-12 rounded-xl`}
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  if (disabled) {
    return <p className="text-center text-sm text-zinc-400">This booking isn&apos;t ready for pickup.</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-medium">Condition photos</p>
        <CameraCaptureField dict={en} photos={photos} onChange={setPhotos} multiple />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Walk the customer through the checklist</p>
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

      <div>
        <p className="mb-1 text-sm font-medium">Customer confirms (type their name)</p>
        <input
          value={customerSignedName}
          onChange={(e) => setCustomerSignedName(e.target.value)}
          placeholder="Customer's full name"
          className={`w-full ${inputClass}`}
        />
      </div>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <button type="button" disabled={!canSubmit || loading} onClick={submit} className={`w-full ${primaryButtonClass} h-12 rounded-full disabled:opacity-50`}>
        {loading ? "Handing over…" : `Confirm handover — hand out ${batteriesCount} ${batteriesCount === 1 ? "battery" : "batteries"}`}
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CameraCaptureField } from "@/components/CameraCaptureField";
import { en } from "@/lib/i18n/dictionaries/en";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { submitPickupAction } from "./actions";

export function PickupForm({
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
  const [customerSignedName, setCustomerSignedName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      await submitPickupAction(formData);
      router.push("/merchant");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
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
        {loading ? "Handing over…" : "Confirm handover — hand out 2 batteries"}
      </button>
    </div>
  );
}

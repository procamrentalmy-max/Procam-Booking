"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import { dronePhotoSteps } from "@/lib/droneRental/photoSteps";
import { PhotoStepPage, StepTitle } from "@/components/droneRental/PhotoStepPage";
import { BatteryPicker, useBatteryPicks, type BatteryOption } from "@/components/droneRental/BatteryPicker";
import { submitPickupAction, type PickupResult } from "./actions";

/**
 * The handover: one guided photo per page (what to photograph is spelled out on each), then a last page with the
 * checklist and the customer's typed name. Every photo is required.
 */
export function PickupForm({
  bookingId,
  checklistItems,
  disabled,
  batteriesCount,
  photosRequired,
  controllerType,
  batteryOptions,
  summary,
}: {
  /** Every charged battery at the shop that fits this drone. The merchant picks which ones go out; the server checks they're still free. */
  batteryOptions: BatteryOption[];
  /** False for models whose handover has no photo pages (the GT50): straight to the checklist. */
  photosRequired: boolean;
  /** The controller's model name (RC-N3), or null for a drone whose controller has none, for the photo wording. */
  controllerType: string | null;
  /** Who it's for, what goes out, and the deposit status. Shown on the first and last pages, not on every photo page. */
  summary: React.ReactNode;
  batteriesCount: number;
  bookingId: string;
  checklistItems: { item_key: string; label: string }[];
  disabled: boolean;
}) {
  const router = useRouter();
  const steps = photosRequired ? dronePhotoSteps({ controllerType }) : [];
  const [step, setStep] = useState(0); // 0..steps.length-1 are photos; steps.length is the confirm page
  const [photos, setPhotos] = useState<Record<string, File>>({});
  const [acks, setAcks] = useState<Record<string, boolean>>(() => Object.fromEntries(checklistItems.map((i) => [i.item_key, false])));
  const [customerSignedName, setCustomerSignedName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shortened, setShortened] = useState<PickupResult | null>(null);

  const { give, pick, enough, ready } = useBatteryPicks(batteryOptions, batteriesCount);
  const giveLabels = give.map((id) => batteryOptions.find((o) => o.id === id)?.label ?? id);

  const allPhotos = steps.every((s) => photos[s.key]);
  const allChecked = checklistItems.every((i) => acks[i.item_key]);
  const canSubmit = !disabled && ready && allPhotos && allChecked && customerSignedName.trim().length > 0;

  // Chosen once, on the first page (before any photo of them is taken), then shown read-only after that.
  const picker = enough ? (
    <BatteryPicker options={batteryOptions} count={batteriesCount} give={give} onPick={pick} verb="hand out" />
  ) : (
    <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      Only {batteryOptions.length} charged {batteryOptions.length === 1 ? "battery is" : "batteries are"} at the shop; this rental needs {batteriesCount}.
    </p>
  );
  const total = steps.length + 1;

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("bookingId", bookingId);
      formData.set("customerSignedName", customerSignedName);
      formData.set("acknowledgements", JSON.stringify(acks));
      for (const id of give) formData.append("batteryIds", id);
      for (const s of steps) formData.set(`photo_${s.key}`, photos[s.key]);
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
    return (
      <div className="space-y-4">
        {summary}
        <p className="text-center text-sm text-zinc-400">This booking isn&apos;t ready for pickup.</p>
      </div>
    );
  }

  if (step < steps.length) {
    const current = steps[step];
    return (
      <div className="space-y-4">
        {step === 0 && (
          <>
            {summary}
            {picker}
          </>
        )}
        <PhotoStepPage
          step={current}
          index={step}
          total={total}
          photo={photos[current.key]}
          onPhoto={(file) => setPhotos((prev) => ({ ...prev, [current.key]: file }))}
          onBack={step > 0 ? () => setStep(step - 1) : undefined}
          onNext={() => setStep(step + 1)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {summary}
      {steps.length === 0 ? (
        picker
      ) : (
        <p className="rounded-2xl border-2 border-black p-3 text-center text-base font-semibold dark:border-white">Batteries to hand out: {giveLabels.join(" and ") || "none picked"}</p>
      )}
      <StepTitle index={steps.length} total={total} title="Checklist and handover" />

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
      {steps.length > 0 && (
        <button type="button" onClick={() => setStep(steps.length - 1)} className="w-full text-center text-sm text-zinc-500 underline underline-offset-2">
          Back to photos
        </button>
      )}
    </div>
  );
}

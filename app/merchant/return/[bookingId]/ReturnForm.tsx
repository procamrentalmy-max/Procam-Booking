"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dronePhotoSteps } from "@/lib/droneRental/photoSteps";
import { PhotoStepPage, StepTitle } from "@/components/droneRental/PhotoStepPage";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import {
  DRONE_MODEL_PROFILES,
  computeDepositCapture,
  depositMyrFor,
  DepositCaptureError,
  formatMyr,
  type DroneModel,
  type ItemOutcome,
} from "@/lib/droneRental/pricingRules";
import { PayMethodChoice } from "@/components/droneRental/PayMethodChoice";
import type { DrPaidBy } from "@/lib/db/types";
import { submitReturnAction, type ReturnResult } from "./actions";

const OUTCOME_OPTIONS: { value: ItemOutcome; label: string; active: string }[] = [
  { value: "NONE", label: "Fine", active: "border-green-600 bg-green-600 text-white" },
  { value: "DAMAGED", label: "Damaged", active: "border-amber-500 bg-amber-500 text-white" },
  { value: "LOST", label: "Lost", active: "border-red-600 bg-red-600 text-white" },
];

function ItemVerdict({
  title,
  heldMyr,
  outcome,
  damage,
  onOutcome,
  onDamage,
}: {
  title: string;
  heldMyr: number;
  outcome: ItemOutcome;
  damage: string;
  onOutcome: (o: ItemOutcome) => void;
  onDamage: (v: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-base font-semibold text-black dark:text-zinc-50">{title}</p>
        <p className="text-sm text-zinc-500">{formatMyr(heldMyr)} held</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {OUTCOME_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onOutcome(o.value)}
            className={`h-11 rounded-xl border text-sm font-semibold ${
              outcome === o.value ? o.active : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {outcome === "DAMAGED" && (
        <label className="mt-3 block text-sm">
          <span className="font-medium">Damage charge (RM)</span>
          <input
            inputMode="decimal"
            value={damage}
            onChange={(e) => onDamage(e.target.value)}
            placeholder={`Up to ${heldMyr}`}
            className={`mt-1 w-full ${inputClass}`}
          />
        </label>
      )}
      {outcome === "LOST" && <p className="mt-3 text-sm font-medium text-red-700 dark:text-red-400">Full {formatMyr(heldMyr)} will be kept.</p>}
    </div>
  );
}

export function ReturnForm({
  bookingId,
  checklistItems,
  disabled,
  holdOnFile,
  batteriesCount,
  model,
  controllerCode,
  heldBatteryLabels,
}: {
  /** The batteries the customer is holding, shown on the battery photo step so the right ones are photographed. */
  heldBatteryLabels: string[];
  /** The controller's number (CTD-001 or CTG-001) for the controller's verdict card; null if it has none. */
  controllerCode: string | null;
  batteriesCount: number;
  model: DroneModel;
  bookingId: string;
  checklistItems: { item_key: string; label: string }[];
  disabled: boolean;
  holdOnFile: boolean;
}) {
  const router = useRouter();
  const profile = DRONE_MODEL_PROFILES[model];
  const deposit = depositMyrFor(model);
  // A model with no photo pages (the GT50) goes straight to the checklist and the deposit verdict.
  const steps = profile.photosRequired ? dronePhotoSteps(batteriesCount, "return") : [];
  const [step, setStep] = useState(0); // 0..steps.length-1 are the guided photos; steps.length is the verdict page
  const [photos, setPhotos] = useState<Record<string, File>>({});
  const [acks, setAcks] = useState<Record<string, boolean>>(() => Object.fromEntries(checklistItems.map((i) => [i.item_key, false])));
  const [droneOutcome, setDroneOutcome] = useState<ItemOutcome>("NONE");
  const [controllerOutcome, setControllerOutcome] = useState<ItemOutcome>("NONE");
  const [droneDamage, setDroneDamage] = useState("");
  const [controllerDamage, setControllerDamage] = useState("");
  const [notes, setNotes] = useState("");
  const [lateFeeMethod, setLateFeeMethod] = useState<DrPaidBy>("CARD");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReturnResult | null>(null);

  // The same rule the server applies — so what the merchant sees here is
  // exactly what will be captured, and a bad amount is caught before submit.
  let capture: ReturnType<typeof computeDepositCapture> | null = null;
  let captureProblem: string | null = null;
  try {
    capture = computeDepositCapture(
      { outcome: droneOutcome, damageMyr: droneDamage === "" ? undefined : Number(droneDamage) },
      { outcome: controllerOutcome, damageMyr: controllerDamage === "" ? undefined : Number(controllerDamage) },
      model
    );
  } catch (err) {
    captureProblem = err instanceof DepositCaptureError ? err.message : "Check the amounts.";
  }

  const anythingWrong = droneOutcome !== "NONE" || controllerOutcome !== "NONE";
  const allPhotos = steps.every((s) => photos[s.key]);
  const canSubmit = !loading && allPhotos && capture !== null;

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("bookingId", bookingId);
      formData.set("droneOutcome", droneOutcome);
      formData.set("controllerOutcome", controllerOutcome);
      if (droneOutcome === "DAMAGED") formData.set("droneDamageMyr", droneDamage);
      if (controllerOutcome === "DAMAGED") formData.set("controllerDamageMyr", controllerDamage);
      formData.set("acknowledgements", JSON.stringify(acks));
      formData.set("notes", notes);
      formData.set("lateFeePaidBy", lateFeeMethod);
      for (const s of steps) formData.set(`photo_${s.key}`, photos[s.key]);
      setResult(await submitReturnAction(formData));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (disabled) {
    return <p className="text-center text-sm text-zinc-400">This booking isn&apos;t currently active.</p>;
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-green-300 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-950">
          <p className="text-lg font-semibold text-green-900 dark:text-green-100">Return completed</p>
          {result.holdFound && (
            <p className="mt-1 text-sm text-green-800 dark:text-green-200">
              {result.capturedMyr > 0
                ? `${formatMyr(result.capturedMyr)} kept from the deposit; the rest was released.`
                : "The whole deposit was released back to the customer."}
            </p>
          )}
        </div>
        {!result.holdFound && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            There was no card hold on file for this booking, so nothing was charged automatically.
            {result.capturedMyr > 0 ? ` Collect ${formatMyr(result.capturedMyr)} from the customer another way.` : ""}
          </p>
        )}
        {result.lateFeeMyr > 0 && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {lateFeeMethod === "CASH"
              ? `Returned late — a ${formatMyr(result.lateFeeMyr)} late fee is due. Collect it from the customer in cash.`
              : result.lateFeeCharged
              ? `Returned late — a ${formatMyr(result.lateFeeMyr)} late fee was charged to the customer's saved card.`
              : `Returned late — a ${formatMyr(result.lateFeeMyr)} late fee is due, but the saved card couldn't be charged. Collect it from the customer another way.`}
          </p>
        )}
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

  if (step < steps.length) {
    const current = steps[step];
    return (
      <PhotoStepPage
        hint={current.key === "batteries" && heldBatteryLabels.length > 0 ? `Taking back: ${heldBatteryLabels.join(" and ")}` : undefined}
        step={current}
        index={step}
        total={steps.length + 1}
        photo={photos[current.key]}
        onPhoto={(file) => setPhotos((prev) => ({ ...prev, [current.key]: file }))}
        onBack={step > 0 ? () => setStep(step - 1) : undefined}
        onNext={() => setStep(step + 1)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <StepTitle index={steps.length} total={steps.length + 1} title="Checklist and deposit" />

      <section className="space-y-2">
        <p className="text-sm font-semibold">Return checklist</p>
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
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-sm font-semibold">Deposit — how did each item come back?</p>
          <p className="text-xs text-zinc-500">
            {formatMyr(deposit)} is held on the customer&apos;s card. Anything you don&apos;t keep is released.
          </p>
        </div>
        <ItemVerdict
          title="Drone"
          heldMyr={profile.depositDroneMyr}
          outcome={droneOutcome}
          damage={droneDamage}
          onOutcome={setDroneOutcome}
          onDamage={setDroneDamage}
        />
        <ItemVerdict
          title={controllerCode ? `Controller ${controllerCode}` : profile.controllerName}
          heldMyr={profile.depositControllerMyr}
          outcome={controllerOutcome}
          damage={controllerDamage}
          onOutcome={setControllerOutcome}
          onDamage={setControllerDamage}
        />

        <div
          className={`rounded-2xl border-2 p-4 ${
            capture && capture.totalMyr > 0 ? "border-amber-400 bg-amber-50 dark:bg-amber-950" : "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950"
          }`}
        >
          {capture ? (
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Keep from deposit</p>
                <p className="text-2xl font-bold text-black dark:text-zinc-50">{formatMyr(capture.totalMyr)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Release to customer</p>
                <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">{formatMyr(deposit - capture.totalMyr)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{captureProblem}</p>
          )}
        </div>

        {!holdOnFile && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            No card hold is on file for this booking, so nothing can be captured automatically — you&apos;d need to collect any amount owed another way.
          </p>
        )}
      </section>

      {anythingWrong && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What happened? (kept on file)"
          className={`w-full ${inputClass}`}
          rows={3}
        />
      )}

      <div className="space-y-1">
        <PayMethodChoice label="If it's late: how does the customer pay the late fee?" value={lateFeeMethod} onChange={setLateFeeMethod} />
        <p className="text-xs text-zinc-500">Only used when the drone is back past the grace time. Take it in cash, or it goes on their saved card.</p>
      </div>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <button type="button" disabled={!canSubmit} onClick={submit} className={`w-full ${primaryButtonClass} h-12 rounded-full disabled:opacity-50`}>
        {loading
          ? "Completing…"
          : capture && capture.totalMyr > 0
            ? `Complete return · keep ${formatMyr(capture.totalMyr)}`
            : "Complete return · release deposit"}
      </button>
      {steps.length > 0 && (
        <button type="button" onClick={() => setStep(steps.length - 1)} className="w-full text-center text-sm text-zinc-500 underline underline-offset-2">
          Back to photos
        </button>
      )}
    </div>
  );
}

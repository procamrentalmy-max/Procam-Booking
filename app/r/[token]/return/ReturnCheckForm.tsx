"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitReturnConditionCheckAction } from "./actions";

type PhotoStep = { key: string; label: string; instruction: string | null };
type AckStep = { key: string; label: string };

export function ReturnCheckForm({
  token,
  photoSteps,
  ackSteps,
  estimatedLateFeeMyr,
}: {
  token: string;
  photoSteps: PhotoStep[];
  ackSteps: AckStep[];
  estimatedLateFeeMyr: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0..photoSteps.length-1 photos, then acks (if any), then damage declaration
  const [photos, setPhotos] = useState<Record<string, File>>({});
  const [acks, setAcks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ackSteps.map((a) => [a.key, false]))
  );
  const [damageReported, setDamageReported] = useState<boolean | null>(null);
  const [damageDescription, setDamageDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isPhotoStep = step < photoSteps.length;
  const isAckStep = !isPhotoStep && step < photoSteps.length + ackSteps.length;
  const currentPhotoStep = isPhotoStep ? photoSteps[step] : null;
  const currentPhoto = currentPhotoStep ? photos[currentPhotoStep.key] : undefined;
  const allAcksChecked = ackSteps.every((a) => acks[a.key]);

  function handleFileChange(key: string, file: File | null) {
    if (!file) return;
    setPhotos((prev) => ({ ...prev, [key]: file }));
  }

  async function handleSubmit() {
    if (damageReported === null) return;
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("token", token);
      formData.set("damageReported", String(damageReported));
      formData.set("damageDescription", damageDescription);
      for (const ack of ackSteps) {
        formData.set(`ack_${ack.key}`, String(acks[ack.key]));
      }
      for (const photoStep of photoSteps) {
        if (photos[photoStep.key]) formData.set(`photo_${photoStep.key}`, photos[photoStep.key]);
      }
      await submitReturnConditionCheckAction(formData);
      router.push(`/r/${token}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  const totalSteps = photoSteps.length + ackSteps.length + 1;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wide text-zinc-400">
          Step {step + 1} of {totalSteps}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
          {currentPhotoStep ? currentPhotoStep.label : isAckStep ? "Confirm" : "Any Issues?"}
        </h1>
      </div>

      {estimatedLateFeeMyr > 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          This return is overdue — a late fee of at least RM{estimatedLateFeeMyr.toFixed(2)} will be deducted from
          your deposit.
        </p>
      )}

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      {currentPhotoStep && (
        <div className="space-y-4">
          {currentPhotoStep.instruction && (
            <p className="text-center text-sm text-zinc-500">{currentPhotoStep.instruction}</p>
          )}

          <label className="flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700">
            {currentPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL, not optimizable
              <img
                src={URL.createObjectURL(currentPhoto)}
                alt={currentPhotoStep.label}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm text-zinc-400">Tap to take photo</span>
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFileChange(currentPhotoStep.key, e.target.files?.[0] ?? null)}
            />
          </label>

          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!currentPhoto}
            className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Continue
          </button>
        </div>
      )}

      {isAckStep && (
        <div className="space-y-4">
          {ackSteps.map((ack) => (
            <label key={ack.key} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={acks[ack.key]}
                onChange={(e) => setAcks((prev) => ({ ...prev, [ack.key]: e.target.checked }))}
                className="mt-1"
              />
              {ack.label}
            </label>
          ))}
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!allAcksChecked}
            className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Continue
          </button>
        </div>
      )}

      {!currentPhotoStep && !isAckStep && (
        <div className="space-y-4">
          <p className="text-center text-sm text-zinc-500">
            Is there any known damage or problem with the equipment or accessories?
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => setDamageReported(false)}
              className={`flex-1 rounded-full border py-3 font-medium ${
                damageReported === false
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              No issues
            </button>
            <button
              onClick={() => setDamageReported(true)}
              className={`flex-1 rounded-full border py-3 font-medium ${
                damageReported === true
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              Report an issue
            </button>
          </div>

          {damageReported === true && (
            <textarea
              value={damageDescription}
              onChange={(e) => setDamageDescription(e.target.value)}
              placeholder="Describe what happened"
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              rows={4}
            />
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || damageReported === null}
            className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? "Submitting…" : "Complete Return"}
          </button>
        </div>
      )}
    </div>
  );
}

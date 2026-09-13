"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CameraCaptureField } from "@/components/CameraCaptureField";
import type { Locale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { submitPreRentalConditionCheckAction } from "./actions";

type PhotoStep = { key: string; label: string; instruction: string | null };
type AckStep = { key: string; label: string };

export function PreRentalCheckForm({
  token,
  locale,
  photoSteps,
  ackSteps,
}: {
  token: string;
  locale: Locale;
  photoSteps: PhotoStep[];
  ackSteps: AckStep[];
}) {
  const router = useRouter();
  const dict = getDictionary(locale);
  const [step, setStep] = useState(0); // 0..photoSteps.length-1 photos, then acknowledgements
  const [photos, setPhotos] = useState<Record<string, File>>({});
  const [acks, setAcks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ackSteps.map((a) => [a.key, false]))
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isPhotoStep = step < photoSteps.length;
  const currentPhotoStep = isPhotoStep ? photoSteps[step] : null;
  const currentPhoto = currentPhotoStep ? photos[currentPhotoStep.key] : undefined;
  const allAcksChecked = ackSteps.every((a) => acks[a.key]);

  function handleFileChange(key: string, file: File | null) {
    if (!file) return;
    setPhotos((prev) => ({ ...prev, [key]: file }));
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("token", token);
      formData.set("locale", locale);
      for (const ack of ackSteps) {
        formData.set(`ack_${ack.key}`, String(acks[ack.key]));
      }
      for (const photoStep of photoSteps) {
        if (photos[photoStep.key]) formData.set(`photo_${photoStep.key}`, photos[photoStep.key]);
      }
      await submitPreRentalConditionCheckAction(formData);
      router.push(`/r/${token}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : dict.common.somethingWentWrong);
      setLoading(false);
    }
  }

  const totalSteps = photoSteps.length + (ackSteps.length ? 1 : 0);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wide text-zinc-400">{dict.pickup.stepOf(step + 1, totalSteps)}</p>
        <h1 className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
          {currentPhotoStep ? currentPhotoStep.label : dict.pickup.confirmAndStart}
        </h1>
      </div>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      {currentPhotoStep && (
        <div className="space-y-4">
          {currentPhotoStep.instruction && (
            <p className="text-center text-sm text-zinc-500">{currentPhotoStep.instruction}</p>
          )}

          <CameraCaptureField
            dict={dict}
            photos={currentPhoto ? [currentPhoto] : []}
            onChange={(files) => handleFileChange(currentPhotoStep.key, files[0] ?? null)}
          />

          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!currentPhoto}
            className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {dict.common.continue}
          </button>
        </div>
      )}

      {!currentPhotoStep && (
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
            onClick={handleSubmit}
            disabled={loading || !allAcksChecked}
            className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? dict.pickup.startingRental : dict.pickup.startRental}
          </button>
        </div>
      )}
    </div>
  );
}

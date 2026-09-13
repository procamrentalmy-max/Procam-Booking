"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CameraCaptureField } from "@/components/CameraCaptureField";
import type { Locale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { submitReturnConditionCheckAction } from "./actions";

type PhotoStep = { key: string; label: string; instruction: string | null };
type AckStep = { key: string; label: string };

export function ReturnCheckForm({
  token,
  locale,
  photoSteps,
  ackSteps,
  estimatedLateFeeMyr,
}: {
  token: string;
  locale: Locale;
  photoSteps: PhotoStep[];
  ackSteps: AckStep[];
  estimatedLateFeeMyr: number;
}) {
  const router = useRouter();
  const dict = getDictionary(locale);
  const t = dict.returnCheck;
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
      formData.set("locale", locale);
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
      setError(err instanceof Error ? err.message : dict.common.somethingWentWrong);
      setLoading(false);
    }
  }

  const totalSteps = photoSteps.length + ackSteps.length + 1;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wide text-zinc-400">{t.stepOf(step + 1, totalSteps)}</p>
        <h1 className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
          {currentPhotoStep ? currentPhotoStep.label : isAckStep ? t.confirmTitle : t.issuesTitle}
        </h1>
      </div>

      {estimatedLateFeeMyr > 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {t.lateFeeWarning(estimatedLateFeeMyr.toFixed(2))}
        </p>
      )}

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
            {dict.common.continue}
          </button>
        </div>
      )}

      {!currentPhotoStep && !isAckStep && (
        <div className="space-y-4">
          <p className="text-center text-sm text-zinc-500">{t.damageQuestion}</p>

          <div className="flex gap-3">
            <button
              onClick={() => setDamageReported(false)}
              className={`flex-1 rounded-full border py-3 font-medium ${
                damageReported === false
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {t.noIssues}
            </button>
            <button
              onClick={() => setDamageReported(true)}
              className={`flex-1 rounded-full border py-3 font-medium ${
                damageReported === true
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              {t.reportIssue}
            </button>
          </div>

          {damageReported === true && (
            <textarea
              value={damageDescription}
              onChange={(e) => setDamageDescription(e.target.value)}
              placeholder={t.describePlaceholder}
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              rows={4}
            />
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || damageReported === null}
            className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? dict.common.submitting : t.completeReturn}
          </button>
        </div>
      )}
    </div>
  );
}

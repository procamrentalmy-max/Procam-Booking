"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitPreRentalConditionCheckAction } from "./actions";

type PhotoField = "screen_on" | "lens_a" | "lens_b" | "kit_full";

const PHOTO_STEPS: { field: PhotoField; title: string; instruction: string }[] = [
  {
    field: "screen_on",
    title: "Power On",
    instruction: "Turn the camera ON, then photograph the screen showing it's powered on.",
  },
  { field: "lens_a", title: "Lens A", instruction: "Photograph the front lens closely." },
  { field: "lens_b", title: "Lens B", instruction: "Photograph the second lens closely." },
  { field: "kit_full", title: "Full Kit", instruction: "Lay out the camera and every accessory, then photograph it all together." },
];

export function PreRentalCheckForm({ token }: { token: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0..3 photos, 4 = acknowledgements
  const [photos, setPhotos] = useState<Partial<Record<PhotoField, File>>>({});
  const [ackPowersOn, setAckPowersOn] = useState(false);
  const [ackNoDamage, setAckNoDamage] = useState(false);
  const [ackAccessoriesPresent, setAckAccessoriesPresent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isPhotoStep = step < PHOTO_STEPS.length;
  const currentPhotoStep = isPhotoStep ? PHOTO_STEPS[step] : null;
  const currentPhoto = currentPhotoStep ? photos[currentPhotoStep.field] : undefined;

  function handleFileChange(field: PhotoField, file: File | null) {
    if (!file) return;
    setPhotos((prev) => ({ ...prev, [field]: file }));
  }

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set("token", token);
      formData.set("ackPowersOn", String(ackPowersOn));
      formData.set("ackNoDamage", String(ackNoDamage));
      formData.set("ackAccessoriesPresent", String(ackAccessoriesPresent));
      for (const { field } of PHOTO_STEPS) {
        if (photos[field]) formData.set(field, photos[field]!);
      }
      await submitPreRentalConditionCheckAction(formData);
      router.push(`/r/${token}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wide text-zinc-400">
          Step {step + 1} of {PHOTO_STEPS.length + 1}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
          {currentPhotoStep ? currentPhotoStep.title : "Confirm & Start Rental"}
        </h1>
      </div>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      {currentPhotoStep && (
        <div className="space-y-4">
          <p className="text-center text-sm text-zinc-500">{currentPhotoStep.instruction}</p>

          <label className="flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700">
            {currentPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL, not optimizable
              <img
                src={URL.createObjectURL(currentPhoto)}
                alt={currentPhotoStep.title}
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
              onChange={(e) => handleFileChange(currentPhotoStep.field, e.target.files?.[0] ?? null)}
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

      {!currentPhotoStep && (
        <div className="space-y-4">
          <label className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input type="checkbox" checked={ackPowersOn} onChange={(e) => setAckPowersOn(e.target.checked)} className="mt-1" />
            The camera powers on and works.
          </label>
          <label className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input type="checkbox" checked={ackNoDamage} onChange={(e) => setAckNoDamage(e.target.checked)} className="mt-1" />
            I don&apos;t see any visible damage.
          </label>
          <label className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={ackAccessoriesPresent}
              onChange={(e) => setAckAccessoriesPresent(e.target.checked)}
              className="mt-1"
            />
            All the accessories shown in my kit photo are present.
          </label>

          <button
            onClick={handleSubmit}
            disabled={loading || !ackPowersOn || !ackNoDamage || !ackAccessoriesPresent}
            className="w-full rounded-full bg-black py-3 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? "Starting rental…" : "Start Rental"}
          </button>
        </div>
      )}
    </div>
  );
}

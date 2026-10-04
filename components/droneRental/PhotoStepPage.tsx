"use client";

import { CameraCaptureField } from "@/components/CameraCaptureField";
import { en } from "@/lib/i18n/dictionaries/en";
import { primaryButtonClass } from "@/components/formStyles";
import type { DronePhotoStep } from "@/lib/droneRental/photoSteps";

/** "Step 3 of 8" and a title — shared by the photo pages and the final confirm page so they read as one sequence. */
export function StepTitle({ index, total, title }: { index: number; total: number; title: string }) {
  return (
    <div className="text-center">
      {total > 1 && (
        <p className="text-xs uppercase tracking-wide text-zinc-400">
          Step {index + 1} of {total}
        </p>
      )}
      <h2 className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">{title}</h2>
    </div>
  );
}

/**
 * One guided photo on its own page: what to photograph (the label and instruction), the live camera, and
 * Continue once there is a photo. Same pattern as the Insta360 pre-rental check, for the drone kit.
 */
export function PhotoStepPage({
  step,
  index,
  total,
  photo,
  onPhoto,
  onBack,
  onNext,
}: {
  step: DronePhotoStep;
  index: number;
  total: number;
  photo: File | undefined;
  onPhoto: (file: File) => void;
  onBack?: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <StepTitle index={index} total={total} title={step.label} />
      <p className="rounded-xl bg-zinc-100 p-3 text-center text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{step.instruction}</p>

      <CameraCaptureField dict={en} photos={photo ? [photo] : []} onChange={(files) => files[0] && onPhoto(files[0])} />

      <div className="flex gap-3">
        {onBack && (
          <button type="button" onClick={onBack} className="h-12 flex-1 rounded-full border border-zinc-300 text-sm font-medium dark:border-zinc-700">
            Back
          </button>
        )}
        <button type="button" onClick={onNext} disabled={!photo} className={`${primaryButtonClass} h-12 flex-[2] rounded-full disabled:opacity-50`}>
          Continue
        </button>
      </div>
    </div>
  );
}

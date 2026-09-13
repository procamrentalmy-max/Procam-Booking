"use client";

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

type Step = { step_number: number; title: string; body: string };

export function InstructionsCarousel({ token, steps, locale }: { token: string; steps: Step[]; locale: Locale }) {
  const dict = getDictionary(locale);
  const [index, setIndex] = useState(0);
  const step = steps[index];

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wide text-zinc-400">
          {steps.length ? dict.instructionsCarousel.ofCount(index + 1, steps.length) : dict.instructionsCarousel.instructionsFallback}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
          {step?.title ?? dict.instructionsCarousel.noInstructionsYet}
        </h1>
      </div>

      {step && (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-zinc-200 p-6 text-center dark:border-zinc-800">
          <p className="text-base text-zinc-600 dark:text-zinc-400">{step.body}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="flex-1 rounded-full border border-zinc-300 py-3 font-medium disabled:opacity-40 dark:border-zinc-700"
        >
          {dict.common.back}
        </button>
        {index < steps.length - 1 ? (
          <button
            onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}
            className="flex-1 rounded-full bg-black py-3 font-semibold text-white dark:bg-white dark:text-black"
          >
            {dict.common.next}
          </button>
        ) : (
          <Link
            href={`/r/${token}`}
            className="flex flex-1 items-center justify-center rounded-full bg-black py-3 font-semibold text-white dark:bg-white dark:text-black"
          >
            {dict.common.done}
          </Link>
        )}
      </div>
    </div>
  );
}

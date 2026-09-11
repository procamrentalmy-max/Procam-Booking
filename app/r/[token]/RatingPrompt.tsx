"use client";

import { useState } from "react";
import { submitRatingAction } from "./actions";

export function RatingPrompt({ token }: { token: string }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (submitted) {
    return (
      <p className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        Thanks for the feedback!
      </p>
    );
  }

  async function submit(value: number) {
    setRating(value);
    setError(null);
    setLoading(true);
    try {
      await submitRatingAction({ token, rating: value });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-zinc-200 p-4 text-center dark:border-zinc-800">
      <p className="text-sm font-medium">How was your rental?</p>
      <div className="flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            disabled={loading}
            onClick={() => submit(value)}
            onMouseEnter={() => setHovered(value)}
            onMouseLeave={() => setHovered(0)}
            aria-label={`Rate ${value} out of 5 stars`}
            className="p-1 text-2xl leading-none disabled:opacity-50"
          >
            {(hovered || rating) >= value ? "★" : "☆"}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

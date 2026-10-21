"use client";

import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { primaryButtonClass } from "@/components/formStyles";
import { Spinner } from "@/components/Spinner";

type Result = { ok: true } | { ok: false; error: string };

/**
 * A form for an admin action that answers { ok, error }: the button spins while it works, and a refusal is written under the form
 * instead of the page failing to load.
 */
export function ActionForm({
  id,
  action,
  children,
  submitLabel,
  savedText = "Saved.",
  resetOnSuccess = false,
  className = "",
  compact = false,
}: {
  /** Lets inputs elsewhere on the page belong to this form (their form attribute): the fleet page ticks many cards and sends them from one bar. */
  id?: string;
  action: (formData: FormData) => Promise<Result>;
  children: ReactNode;
  submitLabel: string;
  savedText?: string;
  resetOnSuccess?: boolean;
  className?: string;
  /** A small inline form (a row in a list): the message sits under it without taking a whole line when all is well. */
  compact?: boolean;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (result.ok) {
          if (resetOnSuccess) form.current?.reset();
          setMessage({ ok: true, text: savedText });
        } else {
          setMessage({ ok: false, text: result.error });
        }
      } catch {
        setMessage({ ok: false, text: "Could not save. Reload the page and try again." });
      }
    });
  }

  return (
    <form id={id} ref={form} onSubmit={handleSubmit} className={className}>
      {children}
      <button type="submit" disabled={isPending} className={`${primaryButtonClass} flex items-center justify-center gap-2 disabled:opacity-50`}>
        {isPending && <Spinner />}
        {submitLabel}
      </button>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${compact ? "basis-full" : "sm:col-span-2"} ${message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}

"use client";

import { useState, useTransition, type FormEvent } from "react";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { updateStaffCredentialsAction } from "./actions";

export function EditLoginForm({
  id,
  authUserId,
  mode,
  initialIdentifier,
}: {
  id: string;
  authUserId: string;
  mode: "username" | "email";
  initialIdentifier: string;
}) {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = identifier !== initialIdentifier || password !== "";

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await updateStaffCredentialsAction(formData);
        setPassword("");
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <details open={dirty || undefined}>
      <summary className="flex w-fit cursor-pointer items-center gap-1.5 text-sm text-zinc-500 underline underline-offset-2">
        Edit Login
        {dirty && (
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold leading-none text-white"
            title="Unsaved changes"
            aria-label="Unsaved changes"
          >
            !
          </span>
        )}
      </summary>
      <form onSubmit={handleSubmit} className="mt-2 grid gap-2 sm:grid-cols-3">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="authUserId" value={authUserId} />
        <input type="hidden" name="mode" value={mode} />
        <input
          name="identifier"
          type={mode === "email" ? "email" : "text"}
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={mode === "email" ? "Email" : "Username"}
          className={inputClass}
        />
        <input
          name="password"
          type="password"
          placeholder="New password (leave blank to keep)"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        <button type="submit" disabled={isPending} className={`${primaryButtonClass} disabled:opacity-50`}>
          {isPending ? "Saving…" : "Save Login"}
        </button>
      </form>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </details>
  );
}

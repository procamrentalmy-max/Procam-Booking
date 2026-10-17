"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { Spinner } from "@/components/Spinner";
import { createStaffAction } from "./actions";

/** Add Staff: a wrong or taken username or a refused password is shown under the form, instead of the page failing to load. */
export function CreateStaffForm() {
  const form = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await createStaffAction(formData);
        if (result.ok) {
          form.current?.reset();
          setMessage({ ok: true, text: "Account created." });
        } else {
          setMessage({ ok: false, text: result.error });
        }
      } catch {
        setMessage({ ok: false, text: "Could not create the account. Reload the page and try again." });
      }
    });
  }

  return (
    <form ref={form} onSubmit={handleSubmit} className="grid gap-2 sm:grid-cols-2">
      <input name="name" placeholder="Full name" required className={inputClass} />
      <input name="username" placeholder="Username" required minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9._\-]*[A-Za-z0-9]" title="Letters, numbers, dots, underscores and hyphens only, no spaces (3 to 32 characters)" className={inputClass} />
      <input name="password" type="password" placeholder="Password (min 8 characters)" minLength={8} required className={inputClass} />
      <select name="role" defaultValue="PROCAM_STAFF" className={inputClass}>
        <option value="PROCAM_STAFF">Staff</option>
        <option value="ADMIN">Admin</option>
        <option value="DRONE_MERCHANT">Drone Merchant</option>
      </select>
      <button type="submit" disabled={isPending} className={`${primaryButtonClass} flex items-center justify-center gap-2 disabled:opacity-50 sm:col-span-2`}>
        {isPending && <Spinner />}
        {isPending ? "Creating…" : "Create Account"}
      </button>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm sm:col-span-2 ${message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}

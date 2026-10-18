"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { Spinner } from "@/components/Spinner";
import { LocationPicker } from "@/components/admin/LocationPicker";
import { createStaffAction } from "./actions";

/** Add Staff: a wrong or taken username or a refused password is shown under the form, instead of the page failing to load. */
export function CreateStaffForm({ mode }: { mode: "staff" | "merchant" }) {
  const form = useRef<HTMLFormElement>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState(mode === "merchant" ? "DRONE_MERCHANT" : "PROCAM_STAFF");
  // Bumped after a successful create so the map starts afresh for the next account.
  const [formKey, setFormKey] = useState(0);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await createStaffAction(formData);
        if (result.ok) {
          form.current?.reset();
          setFormKey((k) => k + 1);
          setMessage({ ok: true, text: mode === "merchant" ? "Merchant created with its location. Give it drones and batteries on the Fleet page, then open it to customers from its Edit info below." : "Account created." });
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
      <input name="name" placeholder={mode === "merchant" ? "Location name (what customers see)" : "Full name"} required className={inputClass} />
      <input name="username" placeholder="Username" required minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9._\-]*[A-Za-z0-9]" title="Letters, numbers, dots, underscores and hyphens only, no spaces (3 to 32 characters)" className={inputClass} />
      <input name="password" type="password" placeholder="Password (min 8 characters)" minLength={8} required className={inputClass} />
      {mode === "merchant" ? (
        <input type="hidden" name="role" value="DRONE_MERCHANT" />
      ) : (
        <select name="role" value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
          <option value="PROCAM_STAFF">Staff</option>
          <option value="ADMIN">Admin</option>
        </select>
      )}
      {mode === "merchant" && <LocationPicker key={formKey} />}
      <button type="submit" disabled={isPending} className={`${primaryButtonClass} flex items-center justify-center gap-2 disabled:opacity-50 sm:col-span-2`}>
        {isPending && <Spinner />}
        {isPending ? "Creating…" : mode === "merchant" ? "Create merchant" : "Create account"}
      </button>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm sm:col-span-2 ${message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}

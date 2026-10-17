"use client";

import { inputClass } from "@/components/formStyles";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";

/** "WhatsApp number (optional)": filled in, the booking's messages go to WhatsApp; empty, they are texted to the phone number above. */
export function WhatsAppNumberField({ value, onChange, locale }: { value: string; onChange: (next: string) => void; locale: Locale }) {
  const t = droneText(locale).common;
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-black dark:text-zinc-50">{t.whatsappNumber}</span>
      <input
        name="whatsappNumber"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="+60 12-345 6789"
        pattern="[0-9+\-\(\)\s]{6,30}"
        title={t.whatsappNumberInvalid}
        className={`w-full ${inputClass} py-3 text-base`}
      />
      <span className="block text-xs text-zinc-500">{t.whatsappNumberNote}</span>
    </label>
  );
}

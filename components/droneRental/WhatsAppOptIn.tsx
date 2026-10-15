"use client";

import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";

/** "WhatsApp me about my booking": unticked to begin with, so a customer only gets WhatsApp messages if they choose to. */
export function WhatsAppOptIn({ checked, onChange, locale }: { checked: boolean; onChange: (next: boolean) => void; locale: Locale }) {
  const t = droneText(locale).common;
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-300 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <span className="font-medium text-black dark:text-zinc-50">{t.whatsapp}</span>
        <span className="mt-0.5 block text-xs text-zinc-500">{t.whatsappNote}</span>
      </span>
    </label>
  );
}

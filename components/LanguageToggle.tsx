"use client";

import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, LOCALE_LABELS, type Locale } from "@/lib/i18n/locale";

const SHORT_LABELS: Record<Locale, string> = { en: "EN", ms: "BM", zh: "中"};

export function LanguageToggle({ locale }: { locale: Locale }) {
  const router = useRouter();

  function switchTo(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-md justify-end px-6 pt-4">
      <div
        role="group"
        aria-label="Language"
        className="inline-flex rounded-full border border-zinc-300 p-0.5 text-xs dark:border-zinc-700"
      >
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => switchTo(l)}
            aria-pressed={l === locale}
            title={LOCALE_LABELS[l]}
            className={`rounded-full px-2.5 py-1 font-medium ${
              l === locale
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {SHORT_LABELS[l]}
          </button>
        ))}
      </div>
    </div>
  );
}

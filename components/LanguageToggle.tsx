"use client";

import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, LOCALE_LABELS, type Locale } from "@/lib/i18n/locale";

const SHORT_LABELS: Record<Locale, string> = { en: "EN", ms: "BM", zh: "中"};

/** `onDark` is for pages that are always dark regardless of the visitor's theme (the home page): it drops the page-width wrapper and uses fixed light-on-dark colors. */
export function LanguageToggle({ locale, onDark = false }: { locale: Locale; onDark?: boolean }) {
  const router = useRouter();

  function switchTo(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className={onDark ? "flex" : "mx-auto flex w-full max-w-md justify-end px-6 pt-4"}>
      <div
        role="group"
        aria-label="Language"
        className={`inline-flex rounded-full border p-0.5 text-xs ${
          onDark ? "border-zinc-700" : "border-zinc-300 dark:border-zinc-700"
        }`}
      >
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => switchTo(l)}
            aria-pressed={l === locale}
            title={LOCALE_LABELS[l]}
            className={`rounded-full px-2.5 py-1 font-medium ${
              onDark
                ? l === locale
                  ? "bg-white text-black"
                  : "text-zinc-400"
                : l === locale
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

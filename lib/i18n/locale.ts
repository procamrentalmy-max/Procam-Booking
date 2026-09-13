export type Locale = "en" | "ms" | "zh";

export const LOCALES: Locale[] = ["en", "ms", "zh"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "procam_locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ms: "Bahasa Melayu",
  zh: "中文",
};

/** Widely-supported Intl tags used for locale-aware date/time formatting. */
export const INTL_TAGS: Record<Locale, string> = {
  en: "en-GB",
  ms: "ms-MY",
  zh: "zh-CN",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as string[]).includes(value);
}

export function formatDateTime(date: Date, locale: Locale): string {
  return date.toLocaleString(INTL_TAGS[locale]);
}

/** ProCam only operates in Malaysia — pickup/collect-by/destroy-by times are always shown in Malaysia local time, regardless of the server's own timezone. */
export function formatMalaysiaTime(date: Date, locale: Locale): string {
  return date.toLocaleString(INTL_TAGS[locale], {
    timeZone: "Asia/Kuala_Lumpur",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

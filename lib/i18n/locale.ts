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

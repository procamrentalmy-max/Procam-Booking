import type { Locale } from "../locale";
import { en, type Dictionary } from "./en";
import { ms } from "./ms";
import { zh } from "./zh";

export type { Dictionary };

const dictionaries: Record<Locale, Dictionary> = { en, ms, zh };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";

/** Customers are mostly in Malaysia: the country code the phone field starts with, and what a number typed without one is read as. */
export const DEFAULT_COUNTRY: CountryCode = "MY";

/**
 * A phone number written in full international form (E.164: a plus, the country code and the number, digits only, like +60123456789), or null when it
 * is not a valid number for that country. A number typed without a country code (012-345 6789) is read as `country`. This is what is saved
 * for a customer, so the same person always has the same number, however it was typed.
 */
export function normalizePhone(input: string, country: CountryCode = DEFAULT_COUNTRY): string | null {
  const text = input.trim();
  if (!text) return null;
  const parsed = parsePhoneNumberFromString(text, country);
  return parsed && parsed.isValid() ? parsed.number : null;
}

/** A normal email address: something, an @, a domain with a dot and a real-looking ending. No spaces, no double dots, not too long. */
export function isValidEmail(input: string): boolean {
  const email = input.trim();
  if (email.length < 6 || email.length > 254) return false;
  if (/\s/.test(email) || email.includes("..")) return false;
  return /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/.test(email) && !email.startsWith(".") && !email.split("@")[0].endsWith(".");
}

export type CountryOption = { code: CountryCode; dial: string; name: string; flag: string };

/** Countries listed first in the country code picker; the rest follow in alphabetical order. */
const FIRST_COUNTRIES: CountryCode[] = ["MY", "SG", "ID", "TH", "BN", "CN", "HK", "TW", "IN", "JP", "KR", "AU", "GB", "US"];

const flagOf = (code: string) => String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

let cache: CountryOption[] | null = null;

/** Every country with its calling code, name (in English) and flag, Malaysia first. */
export function countryOptions(): CountryOption[] {
  if (cache) return cache;
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const all = getCountries().map((code) => ({ code, dial: `+${getCountryCallingCode(code)}`, name: names.of(code) ?? code, flag: flagOf(code) }));
  const first = FIRST_COUNTRIES.map((code) => all.find((c) => c.code === code)).filter((c): c is CountryOption => !!c);
  const rest = all.filter((c) => !FIRST_COUNTRIES.includes(c.code)).sort((a, b) => a.name.localeCompare(b.name));
  cache = [...first, ...rest];
  return cache;
}

/** Splits a saved number into its country and the rest, for filling the field back in (a draft, a returning visitor). */
export function splitPhone(value: string): { country: CountryCode; national: string } {
  const parsed = value.trim().startsWith("+") ? parsePhoneNumberFromString(value) : undefined;
  if (parsed?.country) return { country: parsed.country, national: parsed.nationalNumber };
  return { country: DEFAULT_COUNTRY, national: value.replace(/^\+/, "") };
}

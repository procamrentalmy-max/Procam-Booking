"use client";

import { useEffect, useRef, useState } from "react";
import { getCountryCallingCode, type CountryCode } from "libphonenumber-js/min";
import { inputClass } from "@/components/formStyles";
import { countryOptions, isValidEmail, normalizePhone, splitPhone } from "@/lib/contact";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";

/**
 * The phone number as a country code picker (Malaysia +60 to start) and the number. The value handed up is the full international number (+60123456789)
 * once it is valid; while it is not, whatever has been typed behind the country code. The browser's own form check blocks sending an invalid one,
 * with the message in the visitor's language, and the same check is made again on the server.
 */
export function PhoneField({ value, onChange, locale }: { value: string; onChange: (next: string) => void; locale: Locale }) {
  const t = droneText(locale);
  const initial = splitPhone(value);
  const [country, setCountry] = useState<CountryCode>(initial.country);
  const [national, setNational] = useState(initial.national);
  const [touched, setTouched] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const full = normalizePhone(national, country);
  const invalid = national.trim() !== "" && full === null;

  useEffect(() => {
    input.current?.setCustomValidity(invalid ? t.errors.phone : "");
  }, [invalid, t.errors.phone]);

  // A number handed in from outside (a restored draft) replaces what is shown; the numbers this field built itself are left alone.
  const [emitted, setEmitted] = useState(value);
  if (value !== emitted) {
    const next = splitPhone(value);
    setEmitted(value);
    setCountry(next.country);
    setNational(next.national);
  }

  function emit(nextCountry: CountryCode, nextNational: string) {
    const valid = normalizePhone(nextNational, nextCountry);
    const digits = nextNational.replace(/[^0-9]/g, "");
    const next = valid ?? (digits ? `+${getCountryCallingCode(nextCountry)}${digits}` : "");
    setEmitted(next);
    onChange(next);
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <select
          value={country}
          onChange={(e) => {
            const next = e.target.value as CountryCode;
            setCountry(next);
            emit(next, national);
          }}
          aria-label={t.common.countryCode}
          className={`w-[8.5rem] shrink-0 ${inputClass} py-3 text-base`}
        >
          {countryOptions().map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.dial} {c.name}
            </option>
          ))}
        </select>
        <input
          ref={input}
          value={national}
          onChange={(e) => {
            setNational(e.target.value);
            emit(country, e.target.value);
          }}
          onBlur={() => setTouched(true)}
          placeholder={t.common.phoneNumberPlaceholder}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required
          aria-label={t.common.phone}
          aria-invalid={touched && invalid}
          className={`min-w-0 flex-1 ${inputClass} py-3 text-base`}
        />
      </div>
      {touched && invalid && <p role="alert" className="text-xs text-red-600">{t.errors.phone}</p>}
    </div>
  );
}

/** The email, checked in the browser (and again on the server) as a proper address. */
export function EmailField({ value, onChange, locale }: { value: string; onChange: (next: string) => void; locale: Locale }) {
  const t = droneText(locale);
  const [touched, setTouched] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const invalid = value.trim() !== "" && !isValidEmail(value);

  useEffect(() => {
    input.current?.setCustomValidity(invalid ? t.errors.email : "");
  }, [invalid, t.errors.email]);

  return (
    <div className="space-y-1">
      <input
        ref={input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder={t.common.email}
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        required
        aria-invalid={touched && invalid}
        className={`w-full ${inputClass} py-3 text-base`}
      />
      {touched && invalid && <p role="alert" className="text-xs text-red-600">{t.errors.email}</p>}
    </div>
  );
}

// What the legal pages (Terms, Refunds, Privacy, Contact) say about the business and about the rules the app follows.
// The business details below are shown on the pages only when they are filled in.

import { RETURN_GRACE_MINUTES } from "@/lib/droneRental/slots";
import { INTL_TAGS, type Locale } from "@/lib/i18n/locale";

/** When the legal pages last changed. */
export const LEGAL_UPDATED_ISO = "2026-10-13";

/** That date in the visitor's language ("13 October 2026", "13 Oktober 2026", "2026年10月13日"). */
export function legalUpdatedLabel(locale: Locale): string {
  return new Date(`${LEGAL_UPDATED_ISO}T12:00:00Z`).toLocaleDateString(INTL_TAGS[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export const BUSINESS = {
  /** The name customers know. */
  brand: "ProCam Rental",
  /** The business name exactly as registered with SSM (shown on the Contact page when set). */
  registeredName: "PROCAM RENTAL" as string | null,
  /** The SSM registration number. */
  ssmNumber: "202603270563 (TR0351009-A)" as string | null,
  /** Where customers write to. */
  supportEmail: "procamrental.my@gmail.com" as string | null,
  /** Where customers call or WhatsApp. */
  supportPhone: "+60 17-978 4866" as string | null,
};

/** The registered name only needs spelling out when it differs from the brand (ignoring capitals). */
export const registeredNameDiffers = (): boolean => !!BUSINESS.registeredName && BUSINESS.registeredName.toLowerCase() !== BUSINESS.brand.toLowerCase();

/** The longest rental the online booking page offers, in hours (the duration buttons are built from this). */
export const ONLINE_MAX_HOURS = 6;

/** A customer who cancels at least this many hours before the start gets the rental fee back in full. */
export const FREE_CANCELLATION_HOURS = 24;

export const LATE_GRACE_MINUTES = RETURN_GRACE_MINUTES;

/** How long a card hold normally lasts before the bank releases it by itself. */
export const HOLD_DAYS = 7;

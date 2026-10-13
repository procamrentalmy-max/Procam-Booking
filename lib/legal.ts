// What the legal pages (Terms, Refunds, Privacy, Contact) say about the business and about the rules the app follows.
// The business details below are shown on the pages only when they are filled in.

import { RETURN_GRACE_MINUTES } from "@/lib/droneRental/slots";

export const LEGAL_UPDATED = "13 October 2026";

export const BUSINESS = {
  /** The name customers know. */
  brand: "ProCam Rental",
  /** The business name exactly as registered with SSM (shown on the Contact page when set). */
  registeredName: null as string | null,
  /** The SSM registration number. */
  ssmNumber: null as string | null,
  /** Where customers write to. */
  supportEmail: null as string | null,
  /** Where customers call or WhatsApp. */
  supportPhone: null as string | null,
};

/** Shops customers collect from. Addresses on the booking pages come from the database; these are for the Contact page. */
export const SHOPS = [
  { name: "Country Heights, Kajang", address: "Country Heights, 43000 Kajang, Selangor" },
  { name: "Port Dickson Beach", address: "Port Dickson Beach, Port Dickson, Negeri Sembilan" },
];

/** A customer who cancels at least this many hours before the start gets the rental fee back in full. */
export const FREE_CANCELLATION_HOURS = 24;

export const LATE_GRACE_MINUTES = RETURN_GRACE_MINUTES;

/** How long a card hold normally lasts before the bank releases it by itself. */
export const HOLD_DAYS = 7;

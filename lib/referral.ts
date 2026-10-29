import { WALKIN_QR_ORIGIN } from "@/lib/walkInQr";

/**
 * Flyers at other businesses. Each flyer place has a QR that opens /go/<code>, which remembers (in a cookie on the phone) which flyer it came from for
 * REFERRAL_DAYS days and then shows the landing page. A booking or walk-in order made from that phone in that time belongs to the flyer place, and on it
 * the profit after costs is split 45% merchant, 45% ProCam and 10% to the flyer place instead of 50 / 50 (see earnings.ts).
 */

/** The flyer place's share of the profit after costs on a booking that came from its flyer. */
export const REFERRER_SHARE = 0.1;

/** How long a scan is remembered: a booking from the same phone within this many days is the flyer place's. */
export const REFERRAL_DAYS = 7;
export const REFERRAL_COOKIE = "procam_ref";
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = REFERRAL_DAYS * 24 * 60 * 60;

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i: a flyer can be typed in by hand
export const CODE_LENGTH = 8;

/** A new flyer code: short, lower-case, without look-alike characters. `random` returns bytes (crypto.randomBytes in the server code). */
export function makeFlyerCode(random: (n: number) => ArrayLike<number>): string {
  const bytes = random(CODE_LENGTH);
  return Array.from({ length: CODE_LENGTH }, (_, i) => CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]).join("");
}

export const isFlyerCode = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9]{6,16}$/.test(value);

/** The address on the flyer's QR. Fixed (like the walk-in QR) so a printed flyer keeps working wherever it was generated from. */
export function flyerUrl(code: string): string {
  return `${WALKIN_QR_ORIGIN}/go/${code}`;
}

/** What the cookie holds: the flyer code and a random id for this phone (so a phone that scans again is not counted twice), joined by a dot. */
export function referralCookieValue(code: string, visitorId: string): string {
  return `${code}.${visitorId}`;
}

export function parseReferralCookie(value: string | null | undefined): { code: string; visitorId: string } | null {
  const m = /^([A-Za-z0-9]{6,16})\.([A-Za-z0-9-]{16,64})$/.exec(value ?? "");
  return m ? { code: m[1], visitorId: m[2] } : null;
}

/**
 * Supabase Auth only has email-based identity. Staff/worker accounts log in
 * with a plain username instead of an email, so we synthesize a fake email
 * under a domain nothing will ever actually send mail to and use that as
 * the real Supabase identity behind the scenes. The original admin account
 * keeps its real email — emailToUsername returns null for anything that
 * isn't one of these synthetic addresses, so existing real-email accounts
 * are left alone.
 */
const STAFF_EMAIL_DOMAIN = "staff.procam.internal";

const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]*[a-z0-9]$/i;

export function isValidUsername(username: string): boolean {
  return username.length >= 3 && username.length <= 32 && USERNAME_REGEX.test(username);
}

export function usernameToEmail(username: string): string {
  return `${username.toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;
}

/** Returns the username portion for a synthetic staff email, or null for a real email (e.g. the admin's). */
export function emailToUsername(email: string): string | null {
  const suffix = `@${STAFF_EMAIL_DOMAIN}`;
  return email.toLowerCase().endsWith(suffix) ? email.slice(0, email.length - suffix.length) : null;
}

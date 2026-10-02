/**
 * Staff/merchant/admin sign-ins are meant to last: once someone signs in on a
 * device they stay signed in there until they press Sign out (no "remember
 * me" box). 400 days is the longest lifetime browsers will honour for a
 * cookie, so this is "as long as the browser allows" — the Supabase refresh
 * token itself doesn't expire, and the proxy (proxy.ts) swaps in a fresh
 * access token on every request.
 *
 * Passed explicitly to every Supabase server client rather than relying on
 * the library's current default, so a library upgrade can't quietly shorten
 * it. `secure` is only on in production so plain-http localhost still works.
 */
export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 400 * 24 * 60 * 60,
};

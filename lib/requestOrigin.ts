import "server-only";
import { headers } from "next/headers";

/**
 * The scheme + host the current request actually came in on, e.g.
 * "https://procam-chi.vercel.app" or "http://localhost:3000". Used for links
 * that get printed or scanned (a QR code), where baking in NEXT_PUBLIC_APP_URL
 * would silently point at the wrong site on a preview deploy, after a domain
 * change, or on someone's local dev server.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() ?? (isLocal ? "http" : "https");
  return `${proto}://${host}`;
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_OPTIONS } from "@/lib/supabase/cookieOptions";
import { DEFAULT_LOCALE, LOCALE_COOKIE } from "@/lib/i18n/locale";

const PROTECTED_PREFIXES = ["/admin", "/staff", "/merchant", "/post-login"];

/**
 * A page opened from outside the site (a QR code, a link in a message, a bookmark, a typed address) is a fresh visit and always lands in
 * English, even if the same browser picked another language last time. Moving around inside the site, or switching the language with the
 * EN / BM / 中 switch, keeps the language. Coming back from the bank's or Stripe's payment check (`redirect_status` in the address) is the
 * customer's own visit carrying on, so it keeps their language too.
 */
function isFreshEntry(request: NextRequest): boolean {
  if (request.method !== "GET") return false;
  if (request.headers.get("sec-fetch-dest") !== "document") return false;
  const site = request.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "same-site") return false;
  if (request.nextUrl.searchParams.has("redirect_status")) return false;
  return true;
}

/**
 * Refreshes the Supabase auth cookie on every request and gates the
 * staff/reception route tree to signed-in users. Role-specific checks
 * (admin vs staff vs reception) happen in each area's layout.tsx via
 * lib/auth/session.ts, since that needs a DB lookup this proxy
 * deliberately skips to stay cheap.
 */
export async function proxy(request: NextRequest) {
  // Land in English: the page being rendered must see English too, not just the browser afterwards.
  const picked = request.cookies.get(LOCALE_COOKIE)?.value;
  const resetLanguage = !!picked && picked !== DEFAULT_LOCALE && isFreshEntry(request);
  if (resetLanguage) request.cookies.set(LOCALE_COOKIE, DEFAULT_LOCALE);

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PREFIXES.some((prefix) => request.nextUrl.pathname.startsWith(prefix));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (resetLanguage) response.cookies.set(LOCALE_COOKIE, DEFAULT_LOCALE, { path: "/", maxAge: 31536000, sameSite: "lax" });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

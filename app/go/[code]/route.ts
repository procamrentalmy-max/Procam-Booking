import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getAuthContext, isAdmin } from "@/lib/auth/session";
import { isTestTraffic } from "@/lib/droneFunnel";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE_SECONDS, isFlyerCode, parseReferralCookie, referralCookieValue } from "@/lib/referral";

/**
 * What a flyer's QR opens. The phone is remembered as having come from that flyer for 7 days (a cookie), the scan is counted once per phone, and
 * the visitor lands on the home page. A code that does not exist, or a flyer place that has been stopped, just goes to the home page.
 * The admin's own scans and our test runs are not counted.
 */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const home = new URL("/", request.url);
  if (!isFlyerCode(code)) return NextResponse.redirect(home);

  const supabase = createServiceRoleClient();
  const { data: referrer } = await supabase.from("dr_referrers").select("id,active").eq("code", code).maybeSingle();
  if (!referrer || !referrer.active) return NextResponse.redirect(home);

  // The same phone scanning the same flyer again keeps its id (so it is counted once) and gets a fresh 7 days.
  const existing = parseReferralCookie((await cookies()).get(REFERRAL_COOKIE)?.value);
  const visitorId = existing && existing.code === code ? existing.visitorId : randomUUID();

  // The host the visitor asked for (what the local-address rule looks at), as the funnel sees it.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  const testVisit = isTestTraffic(host, request.headers.get("user-agent"));
  if (!testVisit && !isAdmin(await getAuthContext())) {
    await supabase.from("dr_referral_scans").upsert({ referrer_id: referrer.id, visitor_id: visitorId }, { onConflict: "referrer_id,visitor_id", ignoreDuplicates: true });
  }

  const response = NextResponse.redirect(home);
  response.cookies.set(REFERRAL_COOKIE, referralCookieValue(code, visitorId), {
    maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}

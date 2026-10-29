import "server-only";
import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { REFERRAL_COOKIE, parseReferralCookie } from "@/lib/referral";

/**
 * The flyer place whose QR this phone scanned in the last 7 days (the cookie lives that long), if it is still active. A booking or walk-in order made now
 * belongs to it. Null when the phone never scanned a flyer, the cookie ran out, or the flyer place has been stopped.
 */
export async function referrerIdFromCookie(): Promise<string | null> {
  try {
    const parsed = parseReferralCookie((await cookies()).get(REFERRAL_COOKIE)?.value);
    if (!parsed) return null;
    const { data } = await createServiceRoleClient().from("dr_referrers").select("id,active").eq("code", parsed.code).maybeSingle();
    return data?.active ? data.id : null;
  } catch {
    // Never let the flyer lookup stop a booking.
    return null;
  }
}

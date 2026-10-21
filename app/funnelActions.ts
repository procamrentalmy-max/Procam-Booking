"use server";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { getAuthContext, isAdmin } from "@/lib/auth/session";
import { headers } from "next/headers";
import { DRONE_FUNNEL_KEYS, countryFromHeaders, isTestTraffic } from "@/lib/droneFunnel";

/** What this request is: one of our own tests or a bot (never counted, see isTestTraffic), or a visit and the country it came from (the code only, never the address). */
async function visitContext(): Promise<{ test: boolean; country: string | null }> {
  const h = await headers();
  return { test: isTestTraffic(h.get("host"), h.get("user-agent")), country: countryFromHeaders((name) => h.get(name)) };
}

/**
 * Counts one step of the drone booking flow for one device. Public (customers have no login) and best effort: it never throws, stores no
 * personal data (just a random id kept in the browser, the step and the shop), keeps one row per device per step, and ignores the admin's
 * own testing, local test runs and bots so they don't skew the numbers.
 */
export async function logDroneFunnelAction(input: { sessionId: string; step: string; shopId?: string }): Promise<void> {
  try {
    if (!/^[A-Za-z0-9-]{16,64}$/.test(input.sessionId) || !DRONE_FUNNEL_KEYS.includes(input.step)) return;
    const visit = await visitContext();
    if (isAdmin(await getAuthContext()) || visit.test) return;
    const shopId = input.shopId && /^[0-9a-f-]{36}$/.test(input.shopId) ? input.shopId : null;
    await createServiceRoleClient()
      .from("dr_funnel_events")
      .upsert({ session_id: input.sessionId, step: input.step, shop_id: shopId, country: visit.country }, { onConflict: "session_id,step", ignoreDuplicates: true });
  } catch (err) {
    console.error("[drone funnel] could not count a step", err);
  }
}

/**
 * Counts one thing a visit did with a location: tapped it on the shop list (SELECT), opened its page (OPEN: Check Rates, Book here, or arriving
 * straight on it) or asked for directions (DIRECTIONS). Public, best effort and anonymous like the booking funnel, and it ignores the admin's own
 * testing. Admin > Drone Rental > Locations shows the totals.
 */
export async function logLocationEventAction(input: { sessionId: string; shopId: string; kind: string }): Promise<void> {
  try {
    if (!/^[A-Za-z0-9-]{16,64}$/.test(input.sessionId) || !/^[0-9a-f-]{36}$/.test(input.shopId) || !["SELECT", "OPEN", "DIRECTIONS"].includes(input.kind)) return;
    const visit = await visitContext();
    if (isAdmin(await getAuthContext()) || visit.test) return;
    const supabase = createServiceRoleClient();
    const { data: shop } = await supabase.from("dr_shops").select("active").eq("id", input.shopId).maybeSingle();
    if (!shop) return;
    await supabase.from("dr_location_events").insert({ session_id: input.sessionId, shop_id: input.shopId, kind: input.kind as "SELECT" | "OPEN" | "DIRECTIONS", bookable: shop.active, country: visit.country });
  } catch (err) {
    console.error("[drone locations] could not count an event", err);
  }
}

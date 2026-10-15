"use server";

import { createServiceRoleClient } from "@/lib/supabase/service";
import { getAuthContext, isAdmin } from "@/lib/auth/session";
import { DRONE_FUNNEL_KEYS } from "@/lib/droneFunnel";

/**
 * Counts one step of the drone booking flow for one visit. Public (customers have no login) and best effort: it never throws, stores no
 * personal data (just a random id from the browser tab, the step and the shop), keeps one row per visit per step, and ignores the admin's
 * own testing so it doesn't skew the numbers.
 */
export async function logDroneFunnelAction(input: { sessionId: string; step: string; shopId?: string }): Promise<void> {
  try {
    if (!/^[A-Za-z0-9-]{16,64}$/.test(input.sessionId) || !DRONE_FUNNEL_KEYS.includes(input.step)) return;
    if (isAdmin(await getAuthContext())) return;
    const shopId = input.shopId && /^[0-9a-f-]{36}$/.test(input.shopId) ? input.shopId : null;
    await createServiceRoleClient()
      .from("dr_funnel_events")
      .upsert({ session_id: input.sessionId, step: input.step, shop_id: shopId }, { onConflict: "session_id,step", ignoreDuplicates: true });
  } catch (err) {
    console.error("[drone funnel] could not count a step", err);
  }
}

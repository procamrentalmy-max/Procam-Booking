import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { DemandSignalType } from "@/lib/db/types";

/**
 * Best-effort capacity-planning counter — never allowed to break the flow
 * it's observing (mirrors lib/funnel.ts). Fires only at the exact moments
 * real demand went unmet: a customer's booking attempt found no camera, or
 * a printed photo order found every pickup slot at its hotel full. The
 * admin capacity page (app/admin/capacity) aggregates these to flag where
 * more cameras, more slots, or a new location are actually needed.
 */
export async function logDemandSignal(signalType: DemandSignalType, partnerId: string | null): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("demand_signals").insert({ signal_type: signalType, partner_id: partnerId });
    if (error) console.error("[demand] failed to log signal", signalType, error.message);
  } catch (err) {
    console.error("[demand] failed to log signal", signalType, err);
  }
}

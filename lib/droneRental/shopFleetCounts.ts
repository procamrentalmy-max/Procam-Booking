import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";

/** The drones (not retired or lost) and the batteries a shop has, for the check before it is opened to customers. */
export async function shopFleetCounts(shopId: string): Promise<{ workingDrones: number; batteries: number }> {
  const supabase = createServiceRoleClient();
  const [{ data: drones }, { count: batteries }] = await Promise.all([
    supabase.from("dr_drones").select("status").eq("shop_id", shopId),
    supabase.from("dr_batteries").select("id", { count: "exact", head: true }).eq("shop_id", shopId),
  ]);
  return { workingDrones: (drones ?? []).filter((d) => d.status !== "RETIRED" && d.status !== "LOST").length, batteries: batteries ?? 0 };
}

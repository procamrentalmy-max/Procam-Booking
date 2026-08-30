import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";

/** Rental assets actually free right now at this property — for display only. */
export async function countAvailableAssets(partnerId: string): Promise<number> {
  const supabase = createServiceRoleClient();
  const { count } = await supabase
    .from("rental_assets")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .eq("status", "AVAILABLE");
  return count ?? 0;
}

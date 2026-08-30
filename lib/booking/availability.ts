import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";

/** Rental assets of a given product actually free right now at this property — for display only. */
export async function countAvailableAssets(partnerId: string, productId?: string): Promise<number> {
  const supabase = createServiceRoleClient();
  let query = supabase
    .from("rental_assets")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .eq("status", "AVAILABLE");
  if (productId) query = query.eq("product_id", productId);
  const { count } = await query;
  return count ?? 0;
}

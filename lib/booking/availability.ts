import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";

/** Cameras actually free right now at this property — for display only. */
export async function countAvailableCameras(partnerId: string): Promise<number> {
  const supabase = createServiceRoleClient();
  const { count } = await supabase
    .from("cameras")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .eq("status", "AVAILABLE");
  return count ?? 0;
}

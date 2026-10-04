import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * Charged batteries sitting at the shop that can go out with `droneId`,
 * preferring that drone's own. Batteries fit any drone of the same model at
 * the shop (not the other model: a GT50's battery doesn't go in a Neo 2) —
 * which is what lets a customer swap two batteries at once even though each
 * drone only "owns" three (two out with the customer leaves just one of its
 * own at the shop).
 * Returns fewer than `count` when the shop doesn't have that many charged.
 */
export async function findChargedBatteries(droneId: string, count: number): Promise<{ id: string; human_id: string }[]> {
  const supabase = createServiceRoleClient();

  const { data: drone } = await supabase.from("dr_drones").select("shop_id,model_key").eq("id", droneId).single();
  if (!drone) return [];
  const { data: shopDrones } = await supabase.from("dr_drones").select("id").eq("shop_id", drone.shop_id).eq("model_key", drone.model_key);
  const droneIds = (shopDrones ?? []).map((d) => d.id);
  if (droneIds.length === 0) return [];

  const { data: batteries } = await supabase
    .from("dr_batteries")
    .select("id,human_id,drone_id")
    .in("drone_id", droneIds)
    .eq("status", "AT_SHOP")
    .order("human_id");

  return [...(batteries ?? [])]
    .sort((a, b) => (a.drone_id === droneId ? 0 : 1) - (b.drone_id === droneId ? 0 : 1) || a.human_id.localeCompare(b.human_id))
    .slice(0, count)
    .map(({ id, human_id }) => ({ id, human_id }));
}

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type ChargedBattery = { id: string; human_id: string; name: string | null };

/**
 * Charged batteries sitting at the shop that can go out with `droneId`,
 * preferring that drone's own. Batteries fit any drone of the same model at
 * the shop (not the other model: a GT50's battery doesn't go in a Neo 2) —
 * which is what lets a customer swap two batteries at once even though each
 * drone only "owns" three (two out with the customer leaves just one of its
 * own at the shop).
 * Returns fewer than `count` when the shop doesn't have that many charged.
 */
export async function findChargedBatteries(droneId: string, count: number): Promise<ChargedBattery[]> {
  return (await listChargedBatteries(droneId)).slice(0, count);
}

/** Every charged battery at the shop that fits `droneId` (see findChargedBatteries), this drone's own first, so the merchant can pick one. */
export async function listChargedBatteries(droneId: string): Promise<ChargedBattery[]> {
  const supabase = createServiceRoleClient();

  const { data: drone } = await supabase.from("dr_drones").select("shop_id,model_key").eq("id", droneId).single();
  if (!drone) return [];
  const { data: shopDrones } = await supabase.from("dr_drones").select("id").eq("shop_id", drone.shop_id).eq("model_key", drone.model_key);
  const droneIds = (shopDrones ?? []).map((d) => d.id);
  if (droneIds.length === 0) return [];

  const { data: batteries } = await supabase
    .from("dr_batteries")
    .select("id,human_id,name,drone_id")
    .in("drone_id", droneIds)
    .eq("status", "AT_SHOP")
    .order("human_id");

  return [...(batteries ?? [])]
    .sort((a, b) => (a.drone_id === droneId ? 0 : 1) - (b.drone_id === droneId ? 0 : 1) || a.human_id.localeCompare(b.human_id))
    .map(({ id, human_id, name }) => ({ id, human_id, name }));
}

/**
 * The merchant is shown which batteries to hand out, then submits those exact ones. Before anything is saved this
 * checks they are all still sitting at the shop and still fit this drone (same shop, same model), and that there
 * are exactly `expected` of them. Returns them, or null if anything changed in the meantime (someone else took one,
 * say) so the merchant refreshes and hands out the right ones rather than a different battery than they were told.
 */
export async function validateHandoutBatteries(droneId: string, batteryIds: string[], expected: number): Promise<ChargedBattery[] | null> {
  const ids = [...new Set(batteryIds)];
  if (ids.length !== expected || ids.length !== batteryIds.length) return null;

  const supabase = createServiceRoleClient();
  const { data: drone } = await supabase.from("dr_drones").select("shop_id,model_key").eq("id", droneId).single();
  if (!drone) return null;
  const { data: fitting } = await supabase.from("dr_drones").select("id").eq("shop_id", drone.shop_id).eq("model_key", drone.model_key);
  const fittingIds = new Set((fitting ?? []).map((d) => d.id));

  const { data: rows } = await supabase.from("dr_batteries").select("id,human_id,name,drone_id,status").in("id", ids);
  if ((rows ?? []).length !== ids.length) return null;
  if (!(rows ?? []).every((b) => b.status === "AT_SHOP" && fittingIds.has(b.drone_id))) return null;
  return ids.map((id) => {
    const b = (rows ?? []).find((r) => r.id === id)!;
    return { id: b.id, human_id: b.human_id, name: b.name };
  });
}

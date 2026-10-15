import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { describeDayHours, isOpenNow, parseShopHours } from "./hours";

export type ChargedBattery = { id: string; human_id: string; name: string | null; shop_id: string };

/**
 * Charged batteries sitting AT `atShopId` that can go out with `droneId`, preferring that drone's own. Batteries fit any drone of the same model (not the other model: a GT50's battery doesn't
 * go in a Neo 2), which is what lets a customer swap two batteries at once even though each drone only "owns" three. `atShopId` is the
 * drone's own shop unless the customer is swapping at a different shop. Returns fewer than `count` when the shop doesn't have that many.
 */
export async function findChargedBatteries(droneId: string, count: number, atShopId?: string): Promise<ChargedBattery[]> {
  return (await listChargedBatteries(droneId, atShopId)).slice(0, count);
}

/** Every charged battery at the shop that fits `droneId` (see findChargedBatteries), for the merchant to pick from. */
export async function listChargedBatteries(droneId: string, atShopId?: string): Promise<ChargedBattery[]> {
  const supabase = createServiceRoleClient();

  const { data: drone } = await supabase.from("dr_drones").select("shop_id,model_key").eq("id", droneId).single();
  if (!drone) return [];
  const where = atShopId ?? drone.shop_id;
  const { data: sameModel } = await supabase.from("dr_drones").select("id").eq("model_key", drone.model_key);
  const droneIds = (sameModel ?? []).map((d) => d.id);
  if (droneIds.length === 0) return [];

  const { data: batteries } = await supabase
    .from("dr_batteries")
    .select("id,human_id,name,drone_id,shop_id")
    .in("drone_id", droneIds)
    .eq("status", "AT_SHOP")
    .eq("at_shop_id", where)
    .order("human_id");

  const rank = (b: { drone_id: string }) => (b.drone_id === droneId ? 0 : 1);
  return [...(batteries ?? [])]
    .sort((a, b) => rank(a) - rank(b) || a.human_id.localeCompare(b.human_id))
    .map(({ id, human_id, name, shop_id }) => ({ id, human_id, name, shop_id }));
}

/**
 * The merchant is shown which batteries to hand out, then submits those exact ones. Before anything is saved this
 * checks they are all still sitting at the shop and still fit this drone (same model), and that there
 * are exactly `expected` of them. Returns them, or null if anything changed in the meantime (someone else took one,
 * say) so the merchant refreshes and hands out the right ones rather than a different battery than they were told.
 */
export async function validateHandoutBatteries(droneId: string, batteryIds: string[], expected: number, atShopId?: string): Promise<ChargedBattery[] | null> {
  const ids = [...new Set(batteryIds)];
  if (ids.length !== expected || ids.length !== batteryIds.length) return null;

  const supabase = createServiceRoleClient();
  const { data: drone } = await supabase.from("dr_drones").select("shop_id,model_key").eq("id", droneId).single();
  if (!drone) return null;
  const where = atShopId ?? drone.shop_id;
  const { data: fitting } = await supabase.from("dr_drones").select("id").eq("model_key", drone.model_key);
  const fittingIds = new Set((fitting ?? []).map((d) => d.id));

  const { data: rows } = await supabase.from("dr_batteries").select("id,human_id,name,drone_id,status,at_shop_id,shop_id").in("id", ids);
  if ((rows ?? []).length !== ids.length) return null;
  if (!(rows ?? []).every((b) => b.status === "AT_SHOP" && b.at_shop_id === where && fittingIds.has(b.drone_id))) return null;
  return ids.map((id) => {
    const b = (rows ?? []).find((r) => r.id === id)!;
    return { id: b.id, human_id: b.human_id, name: b.name, shop_id: b.shop_id };
  });
}

export type ShopWithChargedBatteries = { id: string; name: string; address: string; lat: number; lng: number; googleMapsUrl: string | null; charged: number; openNow: boolean; hoursToday: string };

/**
 * Every active shop with how many charged batteries it has right now that fit this drone model, for the customer's "swap at any shop" list.
 * A battery counts at the shop where it physically is, whichever shop it started at: all the batteries are the same.
 */
export async function listShopsWithChargedBatteries(droneModel: string): Promise<ShopWithChargedBatteries[]> {
  const supabase = createServiceRoleClient();
  const [{ data: shops }, { data: sameModel }] = await Promise.all([
    supabase.from("dr_shops").select("id,name,address,lat,lng,google_maps_url,hours").eq("active", true).order("name"),
    supabase.from("dr_drones").select("id").eq("model_key", droneModel),
  ]);
  const droneIds = (sameModel ?? []).map((d) => d.id);
  const { data: batteries } = droneIds.length
    ? await supabase.from("dr_batteries").select("at_shop_id").in("drone_id", droneIds).eq("status", "AT_SHOP")
    : { data: [] as { at_shop_id: string }[] };
  return (shops ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    googleMapsUrl: s.google_maps_url,
    charged: (batteries ?? []).filter((b) => b.at_shop_id === s.id).length,
    openNow: isOpenNow(parseShopHours(s.hours)),
    hoursToday: describeDayHours(parseShopHours(s.hours), new Date()),
  }));
}

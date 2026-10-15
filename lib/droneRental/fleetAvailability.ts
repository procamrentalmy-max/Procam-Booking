import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { CONTROLLER_KINDS, ENABLED_DRONE_MODELS, type ControllerKind, type DroneModel } from "./pricingRules";

/**
 * Which drones and ways of flying ProCam has at all, in any active shop: a drone that is not retired or lost, and a controller of that
 * kind. The home page lists every drone and every way of flying so customers can read the comparison, but one that exists nowhere (the
 * original Neo, the goggles set) is greyed out and can't be picked, just as a shop that has none of it greys it out on the booking page.
 */
export async function getUnavailableFleet(): Promise<{ models: DroneModel[]; controllers: ControllerKind[] }> {
  const supabase = createServiceRoleClient();
  const { data: shops } = await supabase.from("dr_shops").select("id").eq("active", true);
  const shopIds = (shops ?? []).map((s) => s.id);
  if (shopIds.length === 0) return { models: [...ENABLED_DRONE_MODELS], controllers: CONTROLLER_KINDS.filter((k) => k !== "NONE") };
  const [{ data: drones }, { data: controllers }] = await Promise.all([
    supabase.from("dr_drones").select("model_key,status").in("shop_id", shopIds),
    supabase.from("dr_controllers").select("kind").in("shop_id", shopIds),
  ]);
  const haveModels = new Set((drones ?? []).filter((d) => d.status !== "RETIRED" && d.status !== "LOST").map((d) => d.model_key));
  const haveControllers = new Set((controllers ?? []).map((c) => c.kind));
  return {
    models: ENABLED_DRONE_MODELS.filter((m) => !haveModels.has(m)),
    controllers: CONTROLLER_KINDS.filter((k) => k !== "NONE" && !haveControllers.has(k)),
  };
}

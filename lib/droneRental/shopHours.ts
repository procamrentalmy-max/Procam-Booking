import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { parseShopHours, type ShopHours } from "./hours";

/** The opening hours of one shop (the default 08:00 to 22:00 every day when the admin has not set any). */
export async function getShopHours(shopId: string): Promise<ShopHours> {
  const { data } = await createServiceRoleClient().from("dr_shops").select("hours").eq("id", shopId).maybeSingle();
  return parseShopHours(data?.hours);
}

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { AuthContext } from "@/lib/auth/session";

/**
 * Whether this signed-in person may act on a shop: admins on any shop,
 * merchants only on the shop(s) assigned to them (dr_merchant_shops). The
 * merchant screens already only LIST a merchant's own shops, but a server
 * action can be called with any id — so the actions that create or approve
 * things check this themselves rather than trusting the UI.
 */
export async function canAccessShop(ctx: AuthContext | null, shopId: string): Promise<boolean> {
  if (!ctx) return false;
  if (ctx.kind === "admin") return true;
  if (ctx.kind !== "merchant") return false;

  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("dr_merchant_shops")
    .select("shop_id")
    .eq("staff_user_id", ctx.staffId)
    .eq("shop_id", shopId)
    .maybeSingle();
  return !!data;
}

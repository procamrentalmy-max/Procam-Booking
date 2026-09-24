import { getAuthContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { InstantBookingForm } from "./InstantBookingForm";

export default async function InstantBookingPage() {
  const ctx = await getAuthContext();
  const supabase = await createServerSupabaseClient();

  let shopIds: string[] | null = null;
  if (ctx?.kind === "merchant") {
    const { data: assignments } = await supabase.from("dr_merchant_shops").select("shop_id").eq("staff_user_id", ctx.staffId);
    shopIds = (assignments ?? []).map((a) => a.shop_id);
  }

  const shopsQuery = supabase.from("dr_shops").select("id,name").eq("active", true).order("name");
  const { data: shops } = shopIds
    ? await shopsQuery.in("id", shopIds.length ? shopIds : ["00000000-0000-0000-0000-000000000000"])
    : await shopsQuery;

  const shopIdList = (shops ?? []).map((s) => s.id);
  const { data: drones } = shopIdList.length
    ? await supabase.from("dr_drones").select("id,human_id,shop_id").in("shop_id", shopIdList).eq("status", "AVAILABLE")
    : { data: [] };

  return (
    <div className="space-y-4 pt-4">
      <h1 className="text-center text-lg font-semibold text-black dark:text-zinc-50">New Walk-In Booking</h1>
      <InstantBookingForm shops={shops ?? []} drones={drones ?? []} />
    </div>
  );
}

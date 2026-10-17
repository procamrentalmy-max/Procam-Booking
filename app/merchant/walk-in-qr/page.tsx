import { getAuthContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { WalkInQrList } from "@/components/droneRental/WalkInQrList";

export const dynamic = "force-dynamic";

/** The shop's standing walk-in QR: shown on a counter, screen or print-out, and scanned by customers who walk in. */
export default async function WalkInQrPage() {
  const ctx = await getAuthContext();
  const supabase = await createServerSupabaseClient();

  let shopIds: string[] | null = null;
  if (ctx?.kind === "merchant") {
    const { data: assignments } = await supabase.from("dr_merchant_shops").select("shop_id").eq("staff_user_id", ctx.staffId);
    shopIds = (assignments ?? []).map((a) => a.shop_id);
  }

  const shopsQuery = supabase.from("dr_shops").select("id,name,walkin_code").order("name");
  const { data: shops } = shopIds ? await shopsQuery.in("id", shopIds.length ? shopIds : ["00000000-0000-0000-0000-000000000000"]) : await shopsQuery;

  return (
    <div className="space-y-5 pb-10 pt-2">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Walk-in QR</h1>
        <p className="mt-1 text-sm text-zinc-500">
          This QR never changes, so print it once and keep it on the counter. Customers scan it in the shop, choose their hours and batteries, and fill in their own details. The order then shows up on your dashboard for you to
          confirm.
        </p>
      </div>

      <WalkInQrList shops={shops ?? []} empty="No shops assigned to your account yet." />
    </div>
  );
}

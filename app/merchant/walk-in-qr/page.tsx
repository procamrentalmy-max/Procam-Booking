import { getAuthContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateQrDataUrl } from "@/lib/qr";
import { requestOrigin } from "@/lib/requestOrigin";

// The origin comes from the live request, so the QR always points at the site it's shown on.
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

  const shopsQuery = supabase.from("dr_shops").select("id,name,walkin_code").eq("active", true).order("name");
  const { data: shops } = shopIds ? await shopsQuery.in("id", shopIds.length ? shopIds : ["00000000-0000-0000-0000-000000000000"]) : await shopsQuery;

  const origin = await requestOrigin();
  const items = await Promise.all(
    (shops ?? []).map(async (s) => {
      const url = `${origin}/rent/walk-in/${s.walkin_code}`;
      return { id: s.id, name: s.name, url, qr: await generateQrDataUrl(url, 400) };
    })
  );

  return (
    <div className="space-y-5 pb-10 pt-2">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Walk-in QR</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Customers scan this in the shop, choose their hours and batteries, and fill in their own details. The order then shows up on your dashboard for you to
          confirm.
        </p>
      </div>

      {items.length === 0 && <p className="text-center text-sm text-zinc-400">No shops assigned to your account yet.</p>}

      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-zinc-200 bg-white p-5 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-base font-semibold text-black dark:text-zinc-50">{item.name}</p>
          <p className="text-sm text-zinc-500">Scan to rent a drone now</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- a generated data: URL, not an optimizable asset */}
          <img src={item.qr} alt={`Walk-in QR code for ${item.name}`} className="mx-auto mt-3 h-72 w-72 max-w-full rounded-lg" />
          <p className="mt-3 break-all text-[11px] text-zinc-400">{item.url}</p>
        </div>
      ))}
    </div>
  );
}

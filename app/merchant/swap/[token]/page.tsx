import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getAuthContext } from "@/lib/auth/session";
import { canAccessShop } from "@/lib/droneRental/access";

export const dynamic = "force-dynamic";

function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-lg font-semibold text-black dark:text-zinc-50">{title}</p>
      {children && <div className="mt-1 text-sm text-zinc-500">{children}</div>}
    </div>
  );
}

/**
 * What a merchant lands on after scanning the swap QR on a customer's phone: straight to the swap screen for that rental, at the shop
 * the customer chose (`?shop=`), which must be one of the merchant's own. The customer's rental can be from any shop.
 */
export default async function MerchantSwapScanPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ shop?: string }> }) {
  const { token } = await params;
  const { shop } = await searchParams;
  const ctx = await getAuthContext();
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("dr_bookings").select("id,status,shop_id").eq("secure_token", token).maybeSingle();
  if (!booking) return <Notice title="QR code not recognised">This isn&apos;t a ProCam booking QR.</Notice>;
  if (booking.status !== "ACTIVE") return <Notice title="Nothing to swap">This rental isn&apos;t out with the customer right now.</Notice>;

  const swapShopId = shop && /^[0-9a-f-]{36}$/.test(shop) ? shop : booking.shop_id;
  if (!(await canAccessShop(ctx, swapShopId))) return <Notice title="That swap is for a different shop">The customer chose a shop that isn&apos;t yours. Ask them to pick your shop on their phone.</Notice>;

  redirect(`/merchant/battery-swap/${booking.id}?shop=${swapShopId}`);
}

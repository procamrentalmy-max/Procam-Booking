import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/Brand";
import { getLogoUrl } from "@/lib/branding";
import { formatMyr, modelProfile } from "@/lib/droneRental/pricingRules";
import { generateQrDataUrl } from "@/lib/qr";
import { requestOrigin } from "@/lib/requestOrigin";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { droneText } from "@/lib/i18n/drone";
import { getLocale } from "@/lib/i18n/getLocale";

export const dynamic = "force-dynamic";

/**
 * "Swap at <shop>": the QR the staff at that shop scan (it opens the swap screen for this rental at that shop), what to bring, and the
 * reminder that the drone and all the batteries still go back to the shop they rented from.
 */
export default async function SwapAtShopPage({ params }: { params: Promise<{ token: string; shopId: string }> }) {
  const { token, shopId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(shopId)) notFound();
  const [locale, logoUrl] = await Promise.all([getLocale(), getLogoUrl()]);
  const t = droneText(locale);
  const supabase = createServiceRoleClient();
  const { data: booking } = await supabase.from("dr_bookings").select("id,status,drone_model,shop_id").eq("secure_token", token).maybeSingle();
  if (!booking) notFound();
  const [{ data: swapShop }, { data: homeShop }] = await Promise.all([
    supabase.from("dr_shops").select("id,name,address,google_maps_url,active").eq("id", shopId).maybeSingle(),
    supabase.from("dr_shops").select("name").eq("id", booking.shop_id).single(),
  ]);
  if (!swapShop || !swapShop.active || booking.status !== "ACTIVE") notFound();
  const fees = modelProfile(booking.drone_model).batteryFeeMyr;
  const qr = await generateQrDataUrl(`${await requestOrigin()}/merchant/swap/${token}?shop=${shopId}`);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-6 py-6">
      <Brand logoUrl={logoUrl} size={22} />
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{t.swap.atTitle(swapShop.name)}</h1>
        <p className="mt-0.5 text-sm text-zinc-500">{swapShop.address}</p>
        {swapShop.google_maps_url && (
          <a href={swapShop.google_maps_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-zinc-500 underline underline-offset-2">
            {t.swap.directions}
          </a>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 p-5 text-center dark:border-zinc-800">
        <p className="text-base font-semibold text-black dark:text-zinc-50">{t.swap.showQr}</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- a generated data: URL, not an optimizable asset */}
        <img src={qr} alt="" className="mx-auto mt-3 h-56 w-56 rounded-lg" />
        <p className="mt-3 text-xs text-zinc-400">{t.swap.qrNote}</p>
        <p className="mt-2 text-xs text-zinc-500">{t.swap.price(formatMyr(fees[1]), formatMyr(fees[2]))}</p>
      </div>

      <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">{t.swap.rule(homeShop?.name ?? "")}</p>

      <div className="flex flex-col gap-2 text-center text-sm text-zinc-500">
        <Link href={`/rent/b/${token}/swap`} className="underline underline-offset-2">
          {t.swap.otherShop}
        </Link>
        <Link href={`/rent/b/${token}`} className="underline underline-offset-2">
          {t.swap.back}
        </Link>
      </div>
    </div>
  );
}

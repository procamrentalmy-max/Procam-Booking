import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/Brand";
import { getLogoUrl } from "@/lib/branding";
import { listShopsWithChargedBatteries } from "@/lib/droneRental/batteries";
import { formatMyr, modelProfile } from "@/lib/droneRental/pricingRules";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { droneText } from "@/lib/i18n/drone";
import { getLocale } from "@/lib/i18n/getLocale";
import { SwapShopList } from "./SwapShopList";

// Which shops have a charged battery changes by the minute.
export const dynamic = "force-dynamic";

/** "Swap a battery": the customer picks the shop to swap at (any shop, not only the one they rented from), from the link to their booking. */
export default async function SwapShopPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [locale, logoUrl] = await Promise.all([getLocale(), getLogoUrl()]);
  const t = droneText(locale);
  const supabase = createServiceRoleClient();
  const { data: booking } = await supabase.from("dr_bookings").select("id,status,drone_model").eq("secure_token", token).maybeSingle();
  if (!booking) notFound();
  const fees = modelProfile(booking.drone_model).batteryFeeMyr;
  const shops = booking.status === "ACTIVE" ? await listShopsWithChargedBatteries(booking.drone_model) : [];

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-6 py-6">
      <Brand logoUrl={logoUrl} size={22} />
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{t.swap.title}</h1>
        {booking.status === "ACTIVE" ? (
          <>
            <p className="mt-1 text-sm text-zinc-500">{t.swap.intro}</p>
            <p className="mt-2 text-xs text-zinc-500">{t.swap.price(formatMyr(fees[1]), formatMyr(fees[2]))}</p>
          </>
        ) : (
          <p className="mt-1 text-sm text-zinc-500">{t.swap.notActive}</p>
        )}
      </div>
      {booking.status === "ACTIVE" && <SwapShopList token={token} shops={shops} locale={locale} />}
      <Link href={`/rent/b/${token}`} className="text-center text-sm text-zinc-500 underline underline-offset-2">
        {t.swap.back}
      </Link>
    </div>
  );
}

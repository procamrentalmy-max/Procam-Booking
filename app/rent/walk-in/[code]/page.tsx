import { notFound } from "next/navigation";
import { getComboPictureUrls, getLogoUrl } from "@/lib/branding";
import { Brand } from "@/components/Brand";
import { findShopByWalkInCode, walkInOptionsByModel, windyModelsNow } from "@/lib/droneRental/walkInRequests";
import { formatWind } from "@/lib/droneRental/windRules";
import { DRONE_MODEL_PROFILES } from "@/lib/droneRental/pricingRules";
import { WalkInOrderForm } from "./WalkInOrderForm";
import { getAuthContext, isAdmin } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/getLocale";
import { droneText } from "@/lib/i18n/drone";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { describeDayHours, isOpenNow } from "@/lib/droneRental/hours";
import { getShopHours } from "@/lib/droneRental/shopHours";
import { buildCompareTables } from "@/lib/droneRental/compareTables";
import { FaqLink } from "@/components/droneRental/FaqLink";

// Which lengths are offered depends on which drones are free right now — never cache this.
export const dynamic = "force-dynamic";

/** What a customer sees after scanning the shop's standing walk-in QR: pick a length and batteries, enter details, send the order. */
export default async function WalkInOrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const locale = await getLocale();
  const t = droneText(locale);
  const shop = await findShopByWalkInCode(code);
  if (!shop) notFound();

  const [options, logoUrl, pictures, windy] = await Promise.all([walkInOptionsByModel(shop.id), getLogoUrl(), getComboPictureUrls(), windyModelsNow(shop.id)]);
  const offered = Object.keys(options).length > 0;
  // Outside the shop's opening hours (set by the admin) nobody is there to confirm an order.
  const shopHours = await getShopHours(shop.id);
  const openNow = isOpenNow(shopHours);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-6 py-6">
      <Brand logoUrl={logoUrl} size={22} />
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-400">{shop.name}</p>
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{t.walkIn.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t.walkIn.sub}</p>
      </div>

      {windy.length > 0 && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {t.walkIn.tooWindyFor(windy.map((w) => t.walkIn.windItem(DRONE_MODEL_PROFILES[w.model].shortName, formatWind(w.windMps), formatWind(w.limitMps))))}
        </p>
      )}

      {!openNow ? (
        <div className="rounded-2xl border border-zinc-200 p-5 text-center dark:border-zinc-800">
          <p className="text-lg font-semibold text-black dark:text-zinc-50">{t.walkIn.closedTitle}</p>
          <p className="mt-1 text-sm text-zinc-500">{t.walkIn.closedText(describeDayHours(shopHours, new Date()))}</p>
        </div>
      ) : !offered ? (
        <div className="rounded-2xl border border-zinc-200 p-5 text-center dark:border-zinc-800">
          <p className="text-lg font-semibold text-black dark:text-zinc-50">{windy.length > 0 ? t.walkIn.tooWindyTitle : t.walkIn.noDroneTitle}</p>
          <p className="mt-1 text-sm text-zinc-500">{windy.length > 0 ? t.walkIn.tooWindyText : t.walkIn.noDroneText}</p>
        </div>
      ) : (
        <WalkInOrderForm locale={locale} code={code} options={options} pictures={pictures} adminCanSkip={isAdmin(await getAuthContext())} tables={buildCompareTables(getDictionary(locale).home)} />
      )}

      <FaqLink locale={locale} />
    </div>
  );
}

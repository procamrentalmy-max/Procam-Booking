import { listShopsWithAvailability } from "@/lib/droneRental/shops";
import { ShopMapPicker } from "@/components/droneRental/ShopMapPicker";
import { getLogoUrl } from "@/lib/branding";
import { Brand } from "@/components/Brand";
import { getLocale } from "@/lib/i18n/getLocale";
import { droneText } from "@/lib/i18n/drone";
import Link from "next/link";
import { FunnelBeacon } from "@/components/FunnelBeacon";
import { packageQuery, parsePackagePreset } from "@/lib/droneRental/packagePreset";
import { DAILY_BATTERIES, DRONE_MODEL_PROFILES, controllerLabel, depositMyrFor, formatMyr, isDailyMinutes, rentalFeeMyr } from "@/lib/droneRental/pricingRules";

// Shop list + "first available now/at HH:MM" both depend on live DB state
// (which shops are active, which drones are free right now) — this must
// never be statically prerendered, or it freezes at whatever the database
// looked like at build time (bit us once already: 0 shops existed then).
export const dynamic = "force-dynamic";

export default async function RentLandingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // A package picked on the landing page: shown here, and carried on to the booking page of the shop they choose.
  const preset = parsePackagePreset(await searchParams);
  // Server-rendered without a customer location yet (a browser API, not
  // available server-side) — the client re-fetches sorted-by-distance the
  // moment geolocation resolves. Rendering something immediately (even
  // unsorted) beats a blank page while that permission prompt is pending.
  const [initialShops, logoUrl, locale] = await Promise.all([listShopsWithAvailability(null), getLogoUrl(), getLocale()]);
  const text = droneText(locale);
  const t = text.shops;
  const summary = preset
    ? [
        DRONE_MODEL_PROFILES[preset.model].shortName,
        preset.controller === "NONE" ? text.common.phoneOnly : controllerLabel(preset.model, preset.controller),
        isDailyMinutes(preset.minutes) ? text.common.batteriesAndCharger(DAILY_BATTERIES) : text.common.batteries(preset.batteries),
        text.common.rentalLength(preset.minutes),
        formatMyr(rentalFeeMyr(preset.minutes, preset.batteries, preset.model, preset.controller)),
      ].join(" · ")
    : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-6 py-6">
      <FunnelBeacon step="SHOPS" />
      <Brand logoUrl={logoUrl} size={22} />
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{t.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t.sub}</p>
      </div>
      {preset && summary && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-400">{t.yourPackage}</p>
            <p className="mt-0.5 font-medium">{summary}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{text.common.deposit}: {formatMyr(depositMyrFor(preset.model, preset.controller))}</p>
          </div>
          <Link href="/#price" className="shrink-0 text-xs underline underline-offset-2">
            {t.changePackage}
          </Link>
        </div>
      )}
      <ShopMapPicker initialShops={initialShops} locale={locale} carry={preset ? packageQuery(preset) : undefined} />
    </div>
  );
}

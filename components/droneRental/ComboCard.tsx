import { formatMyr } from "@/lib/droneRental/pricingRules";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";

/**
 * The picture for the combination the customer has chosen (drone, how they fly it, batteries) with the deposit under it, and
 * nothing else: the price is already on the length and battery buttons and in the total below. A combination without an uploaded
 * picture shows just the deposit.
 */
export function ComboCard({ pictureUrl, depositMyr, alt, locale = "en", onDark = false }: { pictureUrl?: string; depositMyr: number; alt: string; locale?: Locale; onDark?: boolean }) {
  const t = droneText(locale);
  return (
    <div className={`overflow-hidden rounded-2xl border ${onDark ? "border-slate-700" : "border-zinc-200 dark:border-zinc-800"}`}>
      {pictureUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local optimizable asset
        <img src={pictureUrl} alt={alt} className={`aspect-[4/3] w-full object-cover object-bottom ${onDark ? "bg-zinc-900" : "bg-zinc-100 dark:bg-zinc-900"}`} />
      )}
      <div className="flex items-baseline justify-between gap-4 px-4 py-3">
        <span className={`text-xs font-medium uppercase tracking-wider ${onDark ? "text-slate-300" : "text-zinc-500"}`}>{t.common.deposit}</span>
        <span className={`text-lg font-semibold tabular-nums ${onDark ? "text-white" : "text-black dark:text-zinc-50"}`}>{formatMyr(depositMyr)}</span>
      </div>
    </div>
  );
}

/** The bottom line of the order: the total to pay and the deposit held. */
export function TotalSummary({ totalMyr, depositMyr, locale = "en", onDark = false }: { totalMyr: number; depositMyr: number; locale?: Locale; onDark?: boolean }) {
  const t = droneText(locale);
  const strong = onDark ? "text-white" : "text-black dark:text-zinc-50";
  return (
    <div className={`space-y-2 border-t pt-4 ${onDark ? "border-slate-600" : "border-zinc-200 dark:border-zinc-800"}`}>
      <div className="flex items-baseline justify-between gap-4">
        <span className={`text-sm font-medium ${onDark ? "text-slate-300" : "text-zinc-500"}`}>{t.common.total}</span>
        <span className={`text-2xl font-semibold tabular-nums ${strong}`}>{formatMyr(totalMyr)}</span>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <span className={`text-sm font-medium ${onDark ? "text-slate-300" : "text-zinc-500"}`}>{t.common.deposit}</span>
        <span className={`text-base font-semibold tabular-nums ${strong}`}>{formatMyr(depositMyr)}</span>
      </div>
    </div>
  );
}

import { formatMyr, type DailyBreakdown } from "@/lib/droneRental/pricingRules";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";
import { DepositHoldNote } from "./DepositHoldNote";

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

/** The days at the daily rate and the multi-day discount, as two lines to go above a total (and nothing for an hourly rental or one day). */
export function DiscountLines({ breakdown, locale = "en", onDark = false }: { breakdown: DailyBreakdown | null; locale?: Locale; onDark?: boolean }) {
  if (!breakdown) return null;
  const t = droneText(locale);
  const muted = onDark ? "text-slate-300" : "text-zinc-500";
  const saving = onDark ? "text-emerald-300" : "text-emerald-700 dark:text-emerald-400";
  return (
    <>
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className={muted}>{t.common.daysAtRate(breakdown.days, formatMyr(breakdown.perDayMyr))}</span>
        <span className={`tabular-nums ${muted}`}>{formatMyr(breakdown.fullMyr)}</span>
      </div>
      <div className={`flex items-baseline justify-between gap-4 text-sm font-medium ${saving}`}>
        <span>{t.common.multiDayDiscount(breakdown.percent)}</span>
        <span className="tabular-nums">-{formatMyr(breakdown.savingMyr)}</span>
      </div>
    </>
  );
}

/** The bottom line of the order: the total to pay and the deposit held. For 2 or 3 days the days and the discount show above the total. */
export function TotalSummary({ totalMyr, depositMyr, locale = "en", onDark = false, breakdown = null }: { totalMyr: number; depositMyr: number; locale?: Locale; onDark?: boolean; breakdown?: DailyBreakdown | null }) {
  const t = droneText(locale);
  const strong = onDark ? "text-white" : "text-black dark:text-zinc-50";
  return (
    <div className={`space-y-2 border-t pt-4 ${onDark ? "border-slate-600" : "border-zinc-200 dark:border-zinc-800"}`}>
      <DiscountLines breakdown={breakdown} locale={locale} onDark={onDark} />
      <div className="flex items-baseline justify-between gap-4">
        <span className={`text-sm font-medium ${onDark ? "text-slate-300" : "text-zinc-500"}`}>{t.common.total}</span>
        <span className={`text-2xl font-semibold tabular-nums ${strong}`}>{formatMyr(totalMyr)}</span>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <span className={`text-sm font-medium ${onDark ? "text-slate-300" : "text-zinc-500"}`}>{t.common.deposit}</span>
        <span className={`text-base font-semibold tabular-nums ${strong}`}>{formatMyr(depositMyr)}</span>
      </div>
      <DepositHoldNote depositMyr={depositMyr} locale={locale} onDark={onDark} />
      <p className={`rounded-lg border p-2 text-xs leading-snug ${onDark ? "border-amber-500/40 bg-amber-950/40 text-amber-200" : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"}`}>{t.common.damageWarning}</p>
    </div>
  );
}

import { formatMyr } from "@/lib/droneRental/pricingRules";

/**
 * The picture for the combination the customer has chosen (drone, how they fly it, batteries) with the deposit under it, and
 * nothing else: the price is already on the length and battery buttons and in the total below. A combination without an uploaded
 * picture shows just the deposit.
 */
export function ComboCard({ pictureUrl, depositMyr, alt }: { pictureUrl?: string; depositMyr: number; alt: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
      {pictureUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local optimizable asset
        <img src={pictureUrl} alt={alt} className="aspect-[4/3] w-full bg-zinc-100 object-cover dark:bg-zinc-900" />
      )}
      <div className="flex items-baseline justify-between gap-4 px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Deposit</span>
        <span className="text-lg font-semibold tabular-nums text-black dark:text-zinc-50">{formatMyr(depositMyr)}</span>
      </div>
    </div>
  );
}

/** The bottom line of the order: the total to pay and the deposit held. */
export function TotalSummary({ totalMyr, depositMyr }: { totalMyr: number; depositMyr: number }) {
  return (
    <div className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium text-zinc-500">Total</span>
        <span className="text-2xl font-semibold tabular-nums text-black dark:text-zinc-50">{formatMyr(totalMyr)}</span>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium text-zinc-500">Deposit</span>
        <span className="text-base font-semibold tabular-nums text-black dark:text-zinc-50">{formatMyr(depositMyr)}</span>
      </div>
    </div>
  );
}

import { formatMyr } from "@/lib/droneRental/pricingRules";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";

/**
 * The deposit is only a hold: nothing is deducted from the customer's bank account. This is the green box that says so, short and hard to miss, wherever a
 * customer sees a deposit amount (the price on the home page, the booking and walk-in pages, the payment page, the booking page).
 */
export function DepositHoldNote({ depositMyr, locale = "en", onDark = false }: { depositMyr: number; locale?: Locale; onDark?: boolean }) {
  const t = droneText(locale).common;
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border-2 p-3 ${
        onDark ? "border-emerald-400 bg-emerald-950/60 text-emerald-50" : "border-emerald-500 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-50"
      }`}
    >
      <svg viewBox="0 0 24 24" aria-hidden className={`mt-0.5 h-6 w-6 shrink-0 ${onDark ? "text-emerald-300" : "text-emerald-600 dark:text-emerald-300"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 4.5 6v5.5c0 4.4 3.1 8.2 7.5 9.5 4.4-1.3 7.5-5.1 7.5-9.5V6L12 3Z" />
        <path d="m9 12.2 2.1 2.1L15.2 10" />
      </svg>
      <div className="min-w-0">
        <p className="text-sm font-bold leading-snug">{t.holdTitle(formatMyr(depositMyr))}</p>
        <p className={`mt-0.5 text-xs leading-snug ${onDark ? "text-emerald-100/90" : "text-emerald-900/80 dark:text-emerald-100/90"}`}>{t.holdText}</p>
      </div>
    </div>
  );
}

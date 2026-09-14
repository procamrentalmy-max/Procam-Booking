import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { logFunnelEvent } from "@/lib/funnel";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { computeDepositTotalMyr } from "@/lib/booking/powerBankRules";
import { acknowledgeDepositNoticeAction } from "./actions";

/**
 * A dedicated stop between "booking created" and the Stripe payment form —
 * the customer has to explicitly acknowledge that the security deposit is
 * a separate hold placed on their card at pickup (see lib/stripe/deposit.ts),
 * not part of today's payment, before they can continue. Declining sends
 * them back to the booking page instead of forward to payment.
 */
export default async function DepositNoticePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("status,partner_id,rental_package_id,battery_id")
    .eq("secure_token", token)
    .maybeSingle();
  if (!booking) notFound();
  if (booking.status !== "PENDING_PAYMENT") redirect(`/r/${token}`);

  const [{ data: pkg }, { data: partner }] = await Promise.all([
    supabase.from("rental_packages").select("deposit_myr,product_id").eq("id", booking.rental_package_id).single(),
    supabase.from("partners").select("referral_code").eq("id", booking.partner_id).single(),
  ]);

  const depositMyr = computeDepositTotalMyr(pkg?.deposit_myr ?? 0, booking.battery_id !== null);

  await logFunnelEvent("DEPOSIT_NOTICE_VIEWED", booking.partner_id);

  const backHref =
    partner?.referral_code && pkg?.product_id
      ? `/p/${partner.referral_code}/book?product=${pkg.product_id}`
      : partner?.referral_code
        ? `/p/${partner.referral_code}`
        : "/";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{dict.depositNotice.title}</h1>
      </div>

      <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <p>{dict.depositNotice.body(depositMyr)}</p>
        <p>{dict.depositNotice.cardHint}</p>
      </div>

      <form action={acknowledgeDepositNoticeAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="locale" value={locale} />
        <label className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input type="checkbox" name="ack" value="true" required className="mt-1" />
          <span>{dict.depositNotice.acknowledge(depositMyr)}</span>
        </label>
        <button
          type="submit"
          className="w-full rounded-full bg-black py-3 font-semibold text-white dark:bg-white dark:text-black"
        >
          {dict.depositNotice.continueToPayment}
        </button>
      </form>

      <Link href={backHref} className="text-center text-sm text-zinc-500 underline underline-offset-2">
        {dict.depositNotice.back}
      </Link>
    </div>
  );
}

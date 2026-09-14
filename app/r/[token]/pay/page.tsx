import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createRentalFeePaymentIntent } from "@/lib/stripe/rental";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { computeDepositTotalMyr } from "@/lib/booking/powerBankRules";
import { PaymentForm } from "@/components/PaymentForm";
import { devBypassPaymentAction } from "./actions";

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id,status,rental_package_id,battery_id")
    .eq("secure_token", token)
    .maybeSingle();
  if (!booking) notFound();
  if (booking.status !== "PENDING_PAYMENT") redirect(`/r/${token}`);

  const { data: pkg } = await supabase
    .from("rental_packages")
    .select("name,price_myr,deposit_myr")
    .eq("id", booking.rental_package_id)
    .single();
  const depositMyr = computeDepositTotalMyr(pkg?.deposit_myr ?? 0, booking.battery_id !== null);

  // Stripe isn't configured with a real key in this environment yet — the
  // dev bypass button below still needs the page to render.
  let clientSecret: string | null = null;
  try {
    ({ clientSecret } = await createRentalFeePaymentIntent(booking.id));
  } catch {
    clientSecret = null;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{dict.pay.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{dict.pay.summary(pkg?.name ?? "", pkg?.price_myr ?? 0, depositMyr)}</p>
      </div>
      {clientSecret ? (
        <PaymentForm clientSecret={clientSecret} returnUrl={`${process.env.NEXT_PUBLIC_APP_URL}/r/${token}`} locale={locale} />
      ) : (
        <p className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-500 dark:border-zinc-800">
          {dict.pay.unavailable}
        </p>
      )}

      {/* DEV ONLY — remove this before launch. Bypasses Stripe entirely. */}
      <form action={devBypassPaymentAction} className="border-t border-dashed border-amber-400 pt-4">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="locale" value={locale} />
        <button
          type="submit"
          className="flex h-10 w-full items-center justify-center rounded-full border border-dashed border-amber-500 text-xs font-medium text-amber-700 dark:text-amber-400"
        >
          {dict.pay.devSkip}
        </button>
      </form>
    </div>
  );
}

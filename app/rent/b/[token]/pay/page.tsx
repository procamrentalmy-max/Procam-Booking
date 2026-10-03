import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createDroneRentalFeePaymentIntent } from "@/lib/droneRental/payment";
import { PaymentForm } from "@/components/PaymentForm";
import { formatMyr } from "@/lib/droneRental/pricingRules";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import { formatDuration } from "@/lib/droneRental/format";
import { devBypassDronePaymentAction } from "./actions";

/** Only ever a same-origin relative path (e.g. /merchant/pickup/<id> for a walk-in) — never an absolute/protocol-relative URL, so this can't be turned into an open redirect via the `next` query param. */
function safeNextPath(next: string | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export default async function DroneBookingPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { token } = await params;
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("dr_bookings")
    .select("id,status,source,rental_fee_myr,deposit_myr,start_time,end_time,shop_id,batteries_count")
    .eq("secure_token", token)
    .maybeSingle();
  if (!booking) notFound();
  if (booking.status !== "PENDING_PAYMENT") redirect(nextPath ?? `/rent/b/${token}`);
  const { data: shop } = await supabase.from("dr_shops").select("name").eq("id", booking.shop_id).single();

  // Stripe may not be configured with a real key in this environment yet —
  // the dev bypass button below still needs the page to render regardless.
  let clientSecret: string | null = null;
  try {
    ({ clientSecret } = await createDroneRentalFeePaymentIntent(booking.id));
  } catch {
    clientSecret = null;
  }

  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}${nextPath ?? `/rent/b/${token}`}`;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-6 py-8">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Pay to confirm</h1>

      <div className="space-y-1.5 rounded-2xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Collect from</span>
          <span className="text-right font-medium">{shop?.name ?? "—"}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Batteries</span>
          <span className="font-medium">{booking.batteries_count}</span>
        </div>
        {booking.source === "MERCHANT_INSTANT" ? (
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">Rental length</span>
            <span className="text-right font-medium">{formatDuration(new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime())}</span>
          </div>
        ) : (
          <>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Start</span>
              <span className="font-medium">{formatMalaysiaTime(new Date(booking.start_time), "en")}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Return by</span>
              <span className="font-medium">{formatMalaysiaTime(new Date(booking.end_time), "en")}</span>
            </div>
          </>
        )}
        <div className="flex justify-between gap-4 border-t border-zinc-100 pt-1.5 dark:border-zinc-800">
          <span className="text-zinc-500">Rental fee, charged now</span>
          <span className="font-semibold">{formatMyr(booking.rental_fee_myr)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Deposit, held on your card</span>
          <span className="font-medium">{formatMyr(booking.deposit_myr)}</span>
        </div>
      </div>
      <p className="-mt-2 text-xs text-zinc-400">
        The deposit is only a hold, not a charge. It&apos;s released when you return the drone and controller in good condition.
      </p>

      {clientSecret ? (
        <PaymentForm clientSecret={clientSecret} returnUrl={returnUrl} locale="en" />
      ) : (
        <p className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-500 dark:border-zinc-800">
          Payment is temporarily unavailable — please try again shortly.
        </p>
      )}

      {/* Local development only: bypasses Stripe entirely. Never rendered in a production build, and the action refuses to run there too. */}
      {process.env.NODE_ENV !== "production" && (
        <form action={devBypassDronePaymentAction} className="border-t border-dashed border-amber-400 pt-4">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="next" value={nextPath ?? ""} />
          <button
            type="submit"
            className="flex h-10 w-full items-center justify-center rounded-full border border-dashed border-amber-500 text-xs font-medium text-amber-700 dark:text-amber-400"
          >
            [DEV] Skip payment
          </button>
        </form>
      )}
    </div>
  );
}

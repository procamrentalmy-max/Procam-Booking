import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createDroneRentalFeePaymentIntent, finishCashCardSetup, startCashCardSetup } from "@/lib/droneRental/payment";
import { PaymentForm } from "@/components/PaymentForm";
import { CashCardForm } from "@/components/droneRental/CashCardForm";
import { AutoRefresh } from "@/components/droneRental/AutoRefresh";
import { formatMyr } from "@/lib/droneRental/pricingRules";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import { formatDuration } from "@/lib/droneRental/format";
import { devBypassDronePaymentAction, devBypassCashChoiceAction } from "./actions";

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
  searchParams: Promise<{ next?: string; method?: string; setup_intent?: string }>;
}) {
  const { token } = await params;
  const { next, method, setup_intent: setupIntentId } = await searchParams;
  const nextPath = safeNextPath(next);
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("dr_bookings")
    .select("id,status,source,paid_by,rental_fee_myr,deposit_myr,start_time,end_time,shop_id,batteries_count")
    .eq("secure_token", token)
    .maybeSingle();
  if (!booking) notFound();
  if (booking.status !== "PENDING_PAYMENT") redirect(nextPath ?? `/rent/b/${token}`);
  const { data: shop } = await supabase.from("dr_shops").select("name").eq("id", booking.shop_id).single();

  // Cash is for walk-ins, who are at the shop. Online bookings are paid up front by card.
  const canPayCash = booking.source === "MERCHANT_INSTANT";
  const nextQuery = nextPath ? `next=${encodeURIComponent(nextPath)}` : "";
  const payPath = `/rent/b/${token}/pay`;
  const withQuery = (extra: string) => {
    const query = [nextQuery, extra].filter(Boolean).join("&");
    return query ? `${payPath}?${query}` : payPath;
  };

  // Back from the card form of a cash rental: keep the card and put the deposit hold on it, then show the waiting screen.
  let cashSetupError: string | null = null;
  if (canPayCash && setupIntentId && booking.paid_by !== "CASH") {
    try {
      await finishCashCardSetup(booking.id, setupIntentId);
    } catch (err) {
      console.error("[drone cash] card setup failed", err);
      cashSetupError = "We couldn't save your card. Please try again, or pay by card instead.";
    }
    if (!cashSetupError) redirect(withQuery(""));
  }

  const cashChosen = booking.paid_by === "CASH";
  const payingCash = canPayCash && method === "cash";

  // Stripe may not be configured with a real key in this environment yet —
  // the dev bypass button below still needs the page to render regardless.
  let clientSecret: string | null = null;
  if (!cashChosen) {
    try {
      ({ clientSecret } = payingCash ? await startCashCardSetup(booking.id) : await createDroneRentalFeePaymentIntent(booking.id));
    } catch {
      clientSecret = null;
    }
  }

  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}${nextPath ?? `/rent/b/${token}`}`;
  const cashReturnUrl = `${process.env.NEXT_PUBLIC_APP_URL}${withQuery("")}`;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-6 py-8">
      {cashChosen && <AutoRefresh seconds={3} />}
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{cashChosen ? "Pay the shop in cash" : "Pay to confirm"}</h1>

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
          <span className="text-zinc-500">{cashChosen || payingCash ? "Rental fee, in cash at the shop" : "Rental fee, charged now"}</span>
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

      {cashChosen ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-center dark:border-amber-800 dark:bg-amber-950">
          <p className="text-base font-semibold text-amber-900 dark:text-amber-200">Your card is saved. Now pay {formatMyr(booking.rental_fee_myr)} in cash to the staff.</p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">This page moves on by itself once they have it.</p>
        </div>
      ) : (
        <>
          {canPayCash && (
            <div className="grid grid-cols-2 gap-2 text-center text-sm font-semibold">
              <Link
                href={withQuery("")}
                className={`rounded-full border py-2.5 ${!payingCash ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"}`}
              >
                Pay by card
              </Link>
              <Link
                href={withQuery("method=cash")}
                className={`rounded-full border py-2.5 ${payingCash ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"}`}
              >
                Pay cash at the shop
              </Link>
            </div>
          )}
          {payingCash && (
            <p className="text-sm text-zinc-500">
              You pay the {formatMyr(booking.rental_fee_myr)} in cash to the staff. We still need your card to hold the deposit, so enter it below. Nothing is charged to it now.
            </p>
          )}
          {cashSetupError && <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{cashSetupError}</p>}

          {clientSecret ? (
            payingCash ? (
              <CashCardForm clientSecret={clientSecret} returnUrl={cashReturnUrl} />
            ) : (
              <PaymentForm clientSecret={clientSecret} returnUrl={returnUrl} locale="en" />
            )
          ) : (
            <p className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-500 dark:border-zinc-800">
              Payment is temporarily unavailable — please try again shortly.
            </p>
          )}
        </>
      )}

      {/* Local development only: bypasses Stripe entirely. Never rendered in a production build, and the action refuses to run there too. */}
      {process.env.NODE_ENV !== "production" && !cashChosen && (
        <div className="space-y-2 border-t border-dashed border-amber-400 pt-4">
          <form action={devBypassDronePaymentAction}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="next" value={nextPath ?? ""} />
            <button
              type="submit"
              className="flex h-10 w-full items-center justify-center rounded-full border border-dashed border-amber-500 text-xs font-medium text-amber-700 dark:text-amber-400"
            >
              [DEV] Skip payment
            </button>
          </form>
          {canPayCash && (
            <form action={devBypassCashChoiceAction}>
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="next" value={nextPath ?? ""} />
              <button
                type="submit"
                className="flex h-10 w-full items-center justify-center rounded-full border border-dashed border-amber-500 text-xs font-medium text-amber-700 dark:text-amber-400"
              >
                [DEV] Choose cash, skip the card
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

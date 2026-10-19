import { PendingLink } from "@/components/PendingLink";
import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createDroneCheckout, finishCashCardSetup, startCashCardSetup } from "@/lib/droneRental/payment";
import { PaymentForm } from "@/components/PaymentForm";
import { SlotCheckedPayment } from "@/components/droneRental/SlotCheckedPayment";
import { SlotTakenDialog } from "@/components/droneRental/SlotTakenDialog";
import { cancelLostBooking, isSlotStillFree } from "@/lib/droneRental/claimSlot";
import { CashCardForm } from "@/components/droneRental/CashCardForm";
import { AutoRefresh } from "@/components/droneRental/AutoRefresh";
import { formatMyr, includesController, storedController } from "@/lib/droneRental/pricingRules";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import { durationLabel, droneText } from "@/lib/i18n/drone";
import { getLocale } from "@/lib/i18n/getLocale";
import { AgreeLine } from "@/components/droneRental/AgreeLine";
import { FaqLink } from "@/components/droneRental/FaqLink";
import { FunnelBeacon } from "@/components/FunnelBeacon";
import { devBypassDronePaymentAction, devBypassCashChoiceAction, adminSkipPaymentAction } from "./actions";
import { getAuthContext, isAdmin } from "@/lib/auth/session";
import { pressableClass } from "@/components/formStyles";
import { getPayQrUrl } from "@/lib/branding";
import { createQrPayment } from "@/lib/droneRental/qrPayments";

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
  searchParams: Promise<{ next?: string; method?: string; setup_intent?: string; problem?: string }>;
}) {
  const { token } = await params;
  const { next, method, setup_intent: setupIntentId, problem } = await searchParams;
  const nextPath = safeNextPath(next);
  const supabase = createServiceRoleClient();
  const locale = await getLocale();
  const t = droneText(locale);

  const { data: booking } = await supabase
    .from("dr_bookings")
    .select("id,status,source,paid_by,rental_fee_myr,deposit_myr,start_time,end_time,shop_id,batteries_count,drone_model,controller_kind")
    .eq("secure_token", token)
    .maybeSingle();
  if (!booking) notFound();
  // The last drone for this time was taken by someone who paid first: say so (their details are still on the booking page they came from).
  if (booking.status === "CANCELLED" && booking.source === "MERCHANT_INSTANT") {
    const { count: refused } = await supabase.from("dr_qr_payments").select("id", { count: "exact", head: true }).eq("booking_id", booking.id).eq("status", "CANCELLED");
    if ((refused ?? 0) > 0) {
      return (
        <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 px-6 py-8 text-center">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{t.pay.qrNotReceived}</h1>
          <p className="text-sm text-zinc-500">{t.pay.qrNotReceivedSub}</p>
        </div>
      );
    }
  }
  if (booking.status === "CANCELLED") return <SlotTakenDialog shopId={booking.shop_id} walkIn={booking.source === "MERCHANT_INSTANT"} locale={locale} />;
  if (booking.status !== "PENDING_PAYMENT") redirect(nextPath ?? `/rent/b/${token}`);
  if (booking.source === "ONLINE" && !(await isSlotStillFree(booking.id))) {
    await cancelLostBooking(booking.id);
    return <SlotTakenDialog shopId={booking.shop_id} locale={locale} />;
  }
  const { data: shop } = await supabase.from("dr_shops").select("name").eq("id", booking.shop_id).single();

  // Cash is for walk-ins, who are at the shop. Online bookings are paid up front by card.
  const canPayCash = booking.source === "MERCHANT_INSTANT";
  // Paying by QR is for walk-ins too, and only once the admin has uploaded the QR picture.
  const payQrUrl = canPayCash ? await getPayQrUrl() : null;
  const canPayQr = !!payQrUrl;
  const nextQuery = nextPath ? `next=${encodeURIComponent(nextPath)}` : "";
  const payPath = `/rent/b/${token}/pay`;
  const withQuery = (extra: string) => {
    const query = [nextQuery, extra].filter(Boolean).join("&");
    return query ? `${payPath}?${query}` : payPath;
  };

  // Back from the card form of a cash rental: keep the card and put the deposit hold on it, then show the waiting screen.
  let cashSetupError: string | null = null;
  if (canPayCash && setupIntentId && booking.paid_by === "CARD") {
    try {
      const chosen = canPayQr && method === "qr" ? "QR" : "CASH";
      await finishCashCardSetup(booking.id, setupIntentId, chosen);
      // The merchant is told a QR payment is on its way; it stays on their dashboard until they have confirmed it.
      if (chosen === "QR") await createQrPayment({ shopId: booking.shop_id, bookingId: booking.id, kind: "RENTAL_FEE", amountMyr: Number(booking.rental_fee_myr) });
    } catch (err) {
      console.error("[drone cash] card setup failed", err);
      cashSetupError = t.pay.cashSetupError;
    }
    if (!cashSetupError) redirect(withQuery(""));
  }

  const cashChosen = booking.paid_by === "CASH";
  const qrChosen = booking.paid_by === "QR";
  // The card is saved and the rental fee is to be paid in cash or by QR: nothing more to take here, the page waits for the merchant.
  const savedOffline = cashChosen || qrChosen;
  const payingCash = canPayCash && method === "cash";
  const payingQr = canPayQr && method === "qr";
  const payingOffline = payingCash || payingQr;

  // Stripe may not be configured with a real key in this environment yet —
  // the dev bypass button below still needs the page to render regardless.
  let clientSecret: string | null = null;
  if (!savedOffline) {
    try {
      ({ clientSecret } = payingOffline ? await startCashCardSetup(booking.id) : await createDroneCheckout(booking.id));
    } catch {
      clientSecret = null;
    }
  }

  // A signed-in admin testing the live site gets a button that confirms the booking without payment (nobody else sees it).
  const adminTester = process.env.NODE_ENV === "production" && isAdmin(await getAuthContext());

  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}${nextPath ?? `/rent/b/${token}`}`;
  const cashReturnUrl = `${process.env.NEXT_PUBLIC_APP_URL}${withQuery(payingQr ? "method=qr" : "")}`;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-6 py-8">
      <FunnelBeacon step="PAY" />
      {savedOffline && <AutoRefresh seconds={3} />}
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{cashChosen ? t.pay.titleCash : qrChosen ? t.pay.titleQr : t.pay.title}</h1>

      <div className="space-y-1.5 rounded-2xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">{t.pay.collectFrom}</span>
          <span className="text-right font-medium">{shop?.name ?? "—"}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">{t.common.batteriesLabel}</span>
          <span className="font-medium">{booking.batteries_count}</span>
        </div>
        {booking.source === "MERCHANT_INSTANT" ? (
          <div className="flex justify-between gap-4">
            <span className="text-zinc-500">{t.pay.rentalLength}</span>
            <span className="text-right font-medium">{durationLabel(new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime(), locale)}</span>
          </div>
        ) : (
          <>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">{t.common.start}</span>
              <span className="font-medium">{formatMalaysiaTime(new Date(booking.start_time), locale)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">{t.common.returnBy}</span>
              <span className="font-medium">{formatMalaysiaTime(new Date(booking.end_time), locale)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between gap-4 border-t border-zinc-100 pt-1.5 dark:border-zinc-800">
          <span className="text-zinc-500">{cashChosen || payingCash ? t.pay.feeCash : qrChosen || payingQr ? t.pay.feeQr : t.pay.feeNow}</span>
          <span className="font-semibold">{formatMyr(booking.rental_fee_myr)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">{t.pay.depositRow}</span>
          <span className="font-medium">{formatMyr(booking.deposit_myr)}</span>
        </div>
      </div>
      <p className="-mt-2 text-xs text-zinc-400">
        {includesController(booking.drone_model, storedController(booking.drone_model, booking.controller_kind)) ? t.pay.depositNoteWithController : t.pay.depositNoteDrone}
      </p>
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs leading-snug text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">{t.common.damageWarning}</p>
      <p className="-mt-2 text-xs text-zinc-400">
        <AgreeLine locale={locale} />
      </p>
      <FaqLink locale={locale} className="-mt-2 text-xs text-zinc-400" />
      {problem && !savedOffline && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{t.pay.holdFailed}</p>}
      {!savedOffline && !payingOffline && <p className="text-xs text-zinc-500">{t.pay.holdFirst}</p>}

      {qrChosen ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-center dark:border-amber-800 dark:bg-amber-950">
            <p className="text-base font-semibold text-amber-900 dark:text-amber-200">{t.pay.qrSaved(formatMyr(booking.rental_fee_myr))}</p>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">{t.pay.qrSavedSub}</p>
          </div>
          {payQrUrl && (
            // The whole picture, as uploaded: full width, its own height, never cropped.
            // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local optimizable asset
            <img src={payQrUrl} alt={t.pay.qrAlt} className="mx-auto h-auto w-full rounded-2xl border border-zinc-200 bg-white object-contain dark:border-zinc-800" />
          )}
        </div>
      ) : cashChosen ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-center dark:border-amber-800 dark:bg-amber-950">
          <p className="text-base font-semibold text-amber-900 dark:text-amber-200">{t.pay.cashSaved(formatMyr(booking.rental_fee_myr))}</p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">{t.pay.cashSavedSub}</p>
        </div>
      ) : (
        <>
          {canPayCash && (
            <div className={`grid gap-2 text-center text-sm font-semibold ${canPayQr ? "grid-cols-3" : "grid-cols-2"}`}>
              <PendingLink
                href={withQuery("")}
                className={`rounded-full border py-2.5 ${!payingOffline ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : pressableClass}`}
              >
                {t.pay.payCard}
              </PendingLink>
              <PendingLink
                href={withQuery("method=cash")}
                className={`rounded-full border py-2.5 ${payingCash ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : pressableClass}`}
              >
                {t.pay.payCash}
              </PendingLink>
              {canPayQr && (
                <PendingLink
                  href={withQuery("method=qr")}
                  className={`rounded-full border py-2.5 ${payingQr ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : pressableClass}`}
                >
                  {t.pay.payQr}
                </PendingLink>
              )}
            </div>
          )}
          {payingCash && (
            <p className="text-sm text-zinc-500">
              {t.pay.cashNote(formatMyr(booking.rental_fee_myr))}
            </p>
          )}
          {payingQr && <p className="text-sm text-zinc-500">{t.pay.qrNote(formatMyr(booking.rental_fee_myr))}</p>}
          {cashSetupError && <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{cashSetupError}</p>}

          {clientSecret ? (
            payingOffline ? (
              <CashCardForm clientSecret={clientSecret} returnUrl={cashReturnUrl} locale={locale} qr={payingQr} />
            ) : (
              booking.source === "ONLINE" ? (
                <SlotCheckedPayment token={token} shopId={booking.shop_id} clientSecret={clientSecret} returnUrl={returnUrl} locale={locale} buttonLabel={t.pay.payAndHold(formatMyr(booking.rental_fee_myr), formatMyr(booking.deposit_myr))} />
              ) : (
                <PaymentForm clientSecret={clientSecret} returnUrl={returnUrl} locale={locale} buttonLabel={t.pay.payAndHold(formatMyr(booking.rental_fee_myr), formatMyr(booking.deposit_myr))} />
              )
            )
          ) : (
            <p className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-500 dark:border-zinc-800">
              {t.pay.unavailable}
            </p>
          )}
        </>
      )}

      {adminTester && !savedOffline && (
        <div className="space-y-2 border-t border-dashed border-amber-400 pt-4">
          <p className="text-center text-xs text-amber-700 dark:text-amber-400">Admin test: confirms this booking without taking any payment or deposit.</p>
          <form action={adminSkipPaymentAction}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="next" value={nextPath ?? ""} />
            <button
              type="submit"
              className="flex h-10 w-full items-center justify-center rounded-full border border-dashed border-amber-500 text-xs font-medium text-amber-700 dark:text-amber-400"
            >
              [ADMIN] Skip payment (test booking)
            </button>
          </form>
        </div>
      )}

      {/* Local development only: bypasses Stripe entirely. Never rendered in a production build, and the action refuses to run there too. */}
      {process.env.NODE_ENV !== "production" && !savedOffline && (
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
          {canPayQr && (
            <form action={devBypassCashChoiceAction}>
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="next" value={nextPath ?? ""} />
              <input type="hidden" name="method" value="QR" />
              <button
                type="submit"
                className="flex h-10 w-full items-center justify-center rounded-full border border-dashed border-amber-500 text-xs font-medium text-amber-700 dark:text-amber-400"
              >
                [DEV] Choose QR, skip the card
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

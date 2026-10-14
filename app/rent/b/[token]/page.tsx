import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import { FaqLink } from "@/components/droneRental/FaqLink";
import { controllerProfileFor, formatMyr, includesController, modelProfile, storedController } from "@/lib/droneRental/pricingRules";
import { generateQrDataUrl } from "@/lib/qr";
import { requestOrigin } from "@/lib/requestOrigin";
import { AutoRefresh } from "@/components/droneRental/AutoRefresh";
import { SlotTakenDialog } from "@/components/droneRental/SlotTakenDialog";
import { durationLabel, droneText } from "@/lib/i18n/drone";
import { getLocale } from "@/lib/i18n/getLocale";
import { DepositConfirm } from "@/components/droneRental/DepositConfirm";
import { finishDepositConfirmation, needsDepositConfirmation } from "@/lib/droneRental/payment";

// The QR stops being offered the moment the merchant accepts it — never cache this page.
export const dynamic = "force-dynamic";

export default async function DroneBookingDashboardPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ payment_intent?: string }> }) {
  const { token } = await params;
  const { payment_intent: returnedIntent } = await searchParams;
  const locale = await getLocale();
  const t = droneText(locale);
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("dr_bookings")
    .select("id,human_id,status,source,start_time,end_time,shop_id,drone_id,rental_fee_myr,deposit_myr,checked_in_at,batteries_count,drone_model,controller_kind")
    .eq("secure_token", token)
    .maybeSingle();
  if (!booking) notFound();
  const controller = storedController(booking.drone_model, booking.controller_kind);
  // Back from confirming the deposit on this page: record the hold (the webhook does too; whichever comes first).
  if (returnedIntent) await finishDepositConfirmation(booking.id, returnedIntent).catch((err) => console.error("[drone deposit] could not record the confirmed hold", err));
  const depositNeeded = await needsDepositConfirmation(booking.id);
  // The only way an online booking ends up cancelled is that someone else paid for the last drone first.
  if (booking.status === "CANCELLED") return <SlotTakenDialog shopId={booking.shop_id} walkIn={booking.source === "MERCHANT_INSTANT"} locale={locale} />;

  const [{ data: shop }, { data: drone }] = await Promise.all([
    supabase.from("dr_shops").select("name,address,google_maps_url").eq("id", booking.shop_id).single(),
    supabase.from("dr_drones").select("human_id").eq("id", booking.drone_id).single(),
  ]);

  // An online booking shows a QR for the merchant to scan; once they accept it the QR is gone (single use).
  const showQr = booking.status === "CONFIRMED" && booking.source === "ONLINE" && !booking.checked_in_at;
  const checkedIn = booking.status === "CONFIRMED" && booking.source === "ONLINE" && !!booking.checked_in_at;
  // A walk-in's real start and return times are set when the staff confirm the handover, so until then they aren't shown (just the length).
  const walkInNotStarted = booking.source === "MERCHANT_INSTANT" && (booking.status === "PENDING_PAYMENT" || booking.status === "CONFIRMED");
  const lengthLabel = durationLabel(new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime(), locale);
  const qrDataUrl = showQr ? await generateQrDataUrl(`${await requestOrigin()}/merchant/scan/${token}`) : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      {showQr && <AutoRefresh seconds={5} />}
      <div className="text-center">
        <p className="text-xs uppercase tracking-wide text-zinc-400">{t.booking.number(booking.human_id)}</p>
        <h1 className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">
          {t.booking.status[booking.status] ?? booking.status}
        </h1>
      </div>

      {booking.status === "CONFIRMED" && (
        <div className="rounded-xl border border-zinc-200 p-4 text-center dark:border-zinc-800">
          <p className="text-base font-medium text-black dark:text-zinc-50">
            {booking.source === "MERCHANT_INSTANT" || checkedIn
              ? checkedIn
                ? t.booking.checkedIn
                : t.booking.paymentReceived
              : t.booking.collectAt(shop?.name ?? t.booking.shopFallback)}
          </p>
          {showQr && shop?.google_maps_url && (
            <a
              href={shop.google_maps_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm text-zinc-500 underline underline-offset-2"
            >
              {t.booking.directions}
            </a>
          )}
        </div>
      )}

      {(booking.status === "CONFIRMED" || booking.status === "ACTIVE") && !walkInNotStarted && (
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{t.common.start}</p>
            <p className="mt-1 text-lg font-semibold text-black dark:text-zinc-50">{formatMalaysiaTime(new Date(booking.start_time), locale)}</p>
          </div>
          <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{t.common.returnBy}</p>
            <p className="mt-1 text-lg font-semibold text-black dark:text-zinc-50">{formatMalaysiaTime(new Date(booking.end_time), locale)}</p>
          </div>
        </div>
      )}

      {depositNeeded && <DepositConfirm locale={locale} token={token} depositLabel={formatMyr(booking.deposit_myr)} returnUrl={`${process.env.NEXT_PUBLIC_APP_URL}/rent/b/${token}`} />}

      {showQr && qrDataUrl && (
        <div className="rounded-2xl border border-zinc-200 p-5 text-center dark:border-zinc-800">
          <p className="text-base font-semibold text-black dark:text-zinc-50">{t.booking.qrTitle}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- a generated data: URL, not an optimizable asset */}
          <img src={qrDataUrl} alt={t.booking.qrAlt} className="mx-auto mt-3 h-56 w-56 rounded-lg" />
          <p className="mt-3 text-xs text-zinc-400">{t.booking.qrNote}</p>
        </div>
      )}

      {(booking.status === "ACTIVE" || booking.status === "COMPLETED") && (
        <p className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {booking.status === "COMPLETED" ? t.booking.completed : includesController(booking.drone_model, controller) ? t.booking.activeWithController : t.booking.activeDroneOnly}
        </p>
      )}

      {booking.status === "PENDING_PAYMENT" && (
        <Link
          href={`/rent/b/${token}/pay`}
          className="flex h-12 items-center justify-center rounded-full bg-black text-sm font-semibold text-white dark:bg-white dark:text-black"
        >
          {t.booking.completePayment}
        </Link>
      )}

      <div className="space-y-2 rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <Row label={t.booking.shop} value={shop?.name ?? "—"} />
        <Row label={t.booking.address} value={shop?.address ?? "—"} />
        <Row label={t.common.drone} value={`${modelProfile(booking.drone_model).shortName} · ${drone?.human_id ?? "—"}`} />
        <Row label={t.booking.includes} value={`${includesController(booking.drone_model, controller) ? t.booking.includesWith(controllerProfileFor(booking.drone_model, controller)?.name ?? "") : t.booking.includesDroneOnly}, ${t.common.batteries(booking.batteries_count)}`} />
        {walkInNotStarted && <Row label={t.common.length} value={lengthLabel} />}
        {booking.status !== "CONFIRMED" && booking.status !== "ACTIVE" && !walkInNotStarted && (
          <>
            <Row label={t.common.start} value={formatMalaysiaTime(new Date(booking.start_time), locale)} />
            <Row label={t.common.returnBy} value={formatMalaysiaTime(new Date(booking.end_time), locale)} />
          </>
        )}
        <Row label={t.common.rentalFee} value={formatMyr(booking.rental_fee_myr)} />
        <Row label={t.booking.depositRefundable} value={formatMyr(booking.deposit_myr)} />
      </div>

      <FaqLink locale={locale} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="shrink-0 text-zinc-500">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

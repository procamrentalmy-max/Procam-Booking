import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import { formatMyr } from "@/lib/droneRental/pricingRules";
import { generateQrDataUrl } from "@/lib/qr";
import { requestOrigin } from "@/lib/requestOrigin";
import { AutoRefresh } from "@/components/droneRental/AutoRefresh";
import { formatDuration } from "@/lib/droneRental/format";

// The QR stops being offered the moment the merchant accepts it — never cache this page.
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  CONFIRMED: "Confirmed",
  ACTIVE: "Rental in progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const STATUS_MESSAGES: Record<string, string> = {
  ACTIVE: "Please return the drone, controller and all batteries to the shop by your return time.",
  COMPLETED: "Thanks for flying with us.",
};

export default async function DroneBookingDashboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("dr_bookings")
    .select("human_id,status,source,start_time,end_time,shop_id,drone_id,rental_fee_myr,deposit_myr,checked_in_at,batteries_count")
    .eq("secure_token", token)
    .maybeSingle();
  if (!booking) notFound();

  const [{ data: shop }, { data: drone }] = await Promise.all([
    supabase.from("dr_shops").select("name,address,google_maps_url").eq("id", booking.shop_id).single(),
    supabase.from("dr_drones").select("human_id").eq("id", booking.drone_id).single(),
  ]);

  // An online booking shows a QR for the merchant to scan; once they accept it the QR is gone (single use).
  const showQr = booking.status === "CONFIRMED" && booking.source === "ONLINE" && !booking.checked_in_at;
  const checkedIn = booking.status === "CONFIRMED" && booking.source === "ONLINE" && !!booking.checked_in_at;
  // A walk-in's real start and return times are set when the staff confirm the handover, so until then they aren't shown (just the length).
  const walkInNotStarted = booking.source === "MERCHANT_INSTANT" && (booking.status === "PENDING_PAYMENT" || booking.status === "CONFIRMED");
  const lengthLabel = formatDuration(new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime());
  const qrDataUrl = showQr ? await generateQrDataUrl(`${await requestOrigin()}/merchant/scan/${token}`) : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      {showQr && <AutoRefresh seconds={5} />}
      <div className="text-center">
        <p className="text-xs uppercase tracking-wide text-zinc-400">Booking {booking.human_id}</p>
        <h1 className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">
          {STATUS_LABELS[booking.status] ?? booking.status}
        </h1>
      </div>

      {booking.status === "CONFIRMED" && (
        <div className="rounded-xl border border-zinc-200 p-4 text-center dark:border-zinc-800">
          <p className="text-base font-medium text-black dark:text-zinc-50">
            {booking.source === "MERCHANT_INSTANT" || checkedIn
              ? checkedIn
                ? "Checked in. The staff will hand over your drone now."
                : "Payment received. The staff will hand over your drone now."
              : `Booking completed. Please collect at ${shop?.name ?? "the shop"}.`}
          </p>
          {showQr && shop?.google_maps_url && (
            <a
              href={shop.google_maps_url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm text-zinc-500 underline underline-offset-2"
            >
              Get directions
            </a>
          )}
        </div>
      )}

      {(booking.status === "CONFIRMED" || booking.status === "ACTIVE") && !walkInNotStarted && (
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Start</p>
            <p className="mt-1 text-lg font-semibold text-black dark:text-zinc-50">{formatMalaysiaTime(new Date(booking.start_time), "en")}</p>
          </div>
          <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Return by</p>
            <p className="mt-1 text-lg font-semibold text-black dark:text-zinc-50">{formatMalaysiaTime(new Date(booking.end_time), "en")}</p>
          </div>
        </div>
      )}

      {showQr && qrDataUrl && (
        <div className="rounded-2xl border border-zinc-200 p-5 text-center dark:border-zinc-800">
          <p className="text-base font-semibold text-black dark:text-zinc-50">Show this QR to the shop</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- a generated data: URL, not an optimizable asset */}
          <img src={qrDataUrl} alt="Your booking QR code" className="mx-auto mt-3 h-56 w-56 rounded-lg" />
          <p className="mt-3 text-xs text-zinc-400">The staff scan it to accept your order. Keep this page open, and keep the link. It&apos;s your booking.</p>
        </div>
      )}

      {STATUS_MESSAGES[booking.status] && (
        <p className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {STATUS_MESSAGES[booking.status]}
        </p>
      )}

      {booking.status === "PENDING_PAYMENT" && (
        <Link
          href={`/rent/b/${token}/pay`}
          className="flex h-12 items-center justify-center rounded-full bg-black text-sm font-semibold text-white dark:bg-white dark:text-black"
        >
          Complete payment
        </Link>
      )}

      <div className="space-y-2 rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <Row label="Shop" value={shop?.name ?? "—"} />
        <Row label="Address" value={shop?.address ?? "—"} />
        <Row label="Drone" value={drone?.human_id ?? "—"} />
        <Row label="Includes" value={`Drone, RC-N3 controller, ${booking.batteries_count} ${booking.batteries_count === 1 ? "battery" : "batteries"}`} />
        {walkInNotStarted && <Row label="Length" value={lengthLabel} />}
        {booking.status !== "CONFIRMED" && booking.status !== "ACTIVE" && !walkInNotStarted && (
          <>
            <Row label="Start" value={formatMalaysiaTime(new Date(booking.start_time), "en")} />
            <Row label="Return by" value={formatMalaysiaTime(new Date(booking.end_time), "en")} />
          </>
        )}
        <Row label="Rental fee" value={formatMyr(booking.rental_fee_myr)} />
        <Row label="Deposit (refundable hold)" value={formatMyr(booking.deposit_myr)} />
      </div>
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

import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getWalkInRequestByToken, requestController, viewOf } from "@/lib/droneRental/walkInRequests";
import { controllerLabel, depositMyrFor, formatMyr, modelProfile, rentalFeeMyr } from "@/lib/droneRental/pricingRules";
import { AutoRefresh } from "@/components/droneRental/AutoRefresh";
import { getLocale } from "@/lib/i18n/getLocale";
import { droneText } from "@/lib/i18n/drone";

// Per-customer and time-sensitive (the merchant confirms, the order expires) — must never be cached.
export const dynamic = "force-dynamic";

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-5 text-center dark:border-zinc-800">
      <p className="text-lg font-semibold text-black dark:text-zinc-50">{title}</p>
      <div className="mt-1 text-sm text-zinc-500">{children}</div>
    </div>
  );
}

/**
 * Where a walk-in customer lands after sending their order from the shop's QR: it waits for the merchant to
 * confirm, then moves on to payment by itself. The link is private to this customer (it's created for their
 * order, unlike the shop's shared QR), so once the order is confirmed it simply follows their booking.
 */
export default async function WalkInCustomerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await getLocale();
  const t = droneText(locale);
  const request = await getWalkInRequestByToken(token);
  if (!request) notFound();

  const view = viewOf(request);
  const supabase = createServiceRoleClient();

  if (view === "ACCEPTED" && request.booking_id) {
    const { data: booking } = await supabase.from("dr_bookings").select("secure_token,status").eq("id", request.booking_id).single();
    if (booking) redirect(booking.status === "PENDING_PAYMENT" ? `/rent/b/${booking.secure_token}/pay` : `/rent/b/${booking.secure_token}`);
  }

  const { data: shop } = await supabase.from("dr_shops").select("name").eq("id", request.shop_id).single();
  const hours = request.duration_minutes / 60;
  const batteries = request.batteries_count === 1 ? 1 : 2;
  const controller = requestController(request);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      {(view === "SUBMITTED" || (view === "ACCEPTED" && !request.booking_id)) && <AutoRefresh seconds={3} />}

      <div className="text-center">
        <p className="text-xs uppercase tracking-wide text-zinc-400">{shop?.name ?? t.waiting.fallbackTitle}</p>
        <h1 className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">{t.waiting.yourOrder}</h1>
      </div>

      <div className="space-y-1 rounded-2xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">{t.common.drone}</span>
          <span className="text-right font-medium">{modelProfile(request.drone_model).shortName}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">{t.common.flyingWith}</span>
          <span className="text-right font-medium">{controller === "NONE" ? t.common.phoneOnly : controllerLabel(request.drone_model, controller)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">{t.common.length}</span>
          <span className="font-medium">{t.common.hours(hours)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">{t.common.batteriesLabel}</span>
          <span className="font-medium">{batteries}</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-zinc-100 pt-1 dark:border-zinc-800">
          <span className="text-zinc-500">{t.common.rentalFee}</span>
          <span className="font-semibold">{formatMyr(rentalFeeMyr(request.duration_minutes, batteries, request.drone_model, controller))}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">{t.common.depositHold}</span>
          <span className="font-medium">{formatMyr(depositMyrFor(request.drone_model, controller))}</span>
        </div>
      </div>

      {view === "SUBMITTED" && (
        <Message title={t.waiting.thanks(request.customer_name ?? "")}>{t.waiting.waiting}</Message>
      )}
      {view === "ACCEPTED" && !request.booking_id && <Message title={t.waiting.confirmedTitle}>{t.waiting.confirmedText}</Message>}
      {view === "DECLINED" && <Message title={t.waiting.declinedTitle}>{t.waiting.declinedText}</Message>}
      {view === "CANCELLED" && <Message title={t.waiting.cancelledTitle}>{t.waiting.cancelledText}</Message>}
      {(view === "EXPIRED" || view === "WAITING") && (
        <Message title={t.waiting.expiredTitle}>{t.waiting.expiredText}</Message>
      )}
    </div>
  );
}

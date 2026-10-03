import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getWalkInRequestByToken, viewOf } from "@/lib/droneRental/walkInRequests";
import { DEPOSIT_MYR, formatMyr, rentalFeeMyr } from "@/lib/droneRental/pricingRules";
import { AutoRefresh } from "@/components/droneRental/AutoRefresh";

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

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      {(view === "SUBMITTED" || (view === "ACCEPTED" && !request.booking_id)) && <AutoRefresh seconds={3} />}

      <div className="text-center">
        <p className="text-xs uppercase tracking-wide text-zinc-400">{shop?.name ?? "Drone rental"}</p>
        <h1 className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">Your order</h1>
      </div>

      <div className="space-y-1 rounded-2xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Drone</span>
          <span className="text-right font-medium">DJI Neo 2 + RC-N3 controller</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Length</span>
          <span className="font-medium">
            {hours} hour{hours === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Batteries</span>
          <span className="font-medium">{batteries}</span>
        </div>
        <div className="flex justify-between gap-4 border-t border-zinc-100 pt-1 dark:border-zinc-800">
          <span className="text-zinc-500">Rental fee</span>
          <span className="font-semibold">{formatMyr(rentalFeeMyr(request.duration_minutes, batteries))}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Deposit hold</span>
          <span className="font-medium">{formatMyr(DEPOSIT_MYR)}</span>
        </div>
      </div>

      {view === "SUBMITTED" && (
        <Message title={`Thanks, ${request.customer_name ?? ""}!`}>
          Waiting for the shop to confirm your order. This page moves on to payment by itself, so keep it open.
        </Message>
      )}
      {view === "ACCEPTED" && !request.booking_id && <Message title="Confirmed. One moment…">Getting your payment page ready.</Message>}
      {view === "DECLINED" && <Message title="The shop couldn't take this order">Please check with the staff.</Message>}
      {view === "CANCELLED" && <Message title="This order was cancelled">Please ask the staff.</Message>}
      {(view === "EXPIRED" || view === "WAITING") && (
        <Message title="This order wasn't confirmed in time">Please ask the staff, or scan the shop&apos;s QR code again.</Message>
      )}
    </div>
  );
}

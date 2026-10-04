import { createServiceRoleClient } from "@/lib/supabase/service";
import { getAuthContext } from "@/lib/auth/session";
import { canAccessShop } from "@/lib/droneRental/access";
import { checkInView } from "@/lib/droneRental/checkIn";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import { formatMyr } from "@/lib/droneRental/pricingRules";
import { ScanButtons } from "./ScanButtons";

// Per-scan and time-sensitive (a QR stops working once accepted) — never cached.
export const dynamic = "force-dynamic";

function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-lg font-semibold text-black dark:text-zinc-50">{title}</p>
      {children && <div className="mt-1 text-sm text-zinc-500">{children}</div>}
    </div>
  );
}

/** What a merchant lands on after scanning a customer's booking QR. */
export default async function MerchantScanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ctx = await getAuthContext();
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("dr_bookings")
    .select("id,human_id,status,checked_in_at,shop_id,customer_id,drone_id,start_time,end_time,rental_fee_myr,deposit_myr")
    .eq("secure_token", token)
    .maybeSingle();

  if (!booking) return <Notice title="QR code not recognised">This isn&apos;t a ProCam booking QR.</Notice>;
  if (!(await canAccessShop(ctx, booking.shop_id))) return <Notice title="This booking is at a different shop">You can only accept orders for your own shop.</Notice>;

  const view = checkInView(booking);
  if (view === "ALREADY_ACCEPTED") {
    return (
      <Notice title="This QR was already used">
        {booking.checked_in_at ? `Accepted at ${formatMalaysiaTime(new Date(booking.checked_in_at), "en").split(", ").pop()}. ` : ""}It can&apos;t be accepted again.
      </Notice>
    );
  }
  if (view === "NOT_PAID") return <Notice title="Not paid yet">This booking hasn&apos;t been paid, so there&apos;s nothing to accept.</Notice>;
  if (view === "CLOSED") return <Notice title="This booking is no longer active">It was cancelled or expired.</Notice>;

  const [{ data: customer }, { data: drone }] = await Promise.all([
    supabase.from("customers").select("name,phone").eq("id", booking.customer_id).single(),
    supabase.from("dr_drones").select("human_id,model_key").eq("id", booking.drone_id).single(),
  ]);

  return (
    <div className="space-y-4 pb-10 pt-2">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Online booking · {booking.human_id}</p>
        <h1 className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">Accept this order?</h1>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-lg font-semibold text-black dark:text-zinc-50">{customer?.name ?? "—"}</p>
        <p className="text-sm text-zinc-500">{customer?.phone ?? "—"}</p>
        <dl className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Drone</dt>
            <dd className="font-medium">
              {drone?.human_id ?? "—"}
              {drone?.model_key === "GT50" ? " · GT50" : ""}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Start</dt>
            <dd className="font-medium">{formatMalaysiaTime(new Date(booking.start_time), "en")}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Return by</dt>
            <dd className="font-medium">{formatMalaysiaTime(new Date(booking.end_time), "en")}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Paid</dt>
            <dd className="font-medium">{formatMyr(booking.rental_fee_myr)}</dd>
          </div>
        </dl>
      </div>

      <p className="text-center text-xs text-zinc-500">Check the name matches the person in front of you. Accepting takes you to the handover.</p>
      <ScanButtons token={token} />
    </div>
  );
}

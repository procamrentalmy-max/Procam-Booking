import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import { formatMyr } from "@/lib/droneRental/pricingRules";

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  CONFIRMED: "Confirmed",
  ACTIVE: "Rental in progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const STATUS_MESSAGES: Record<string, string> = {
  ACTIVE: "Please return the drone, controller and both batteries to the shop by your return time.",
  COMPLETED: "Thanks for flying with us.",
};

export default async function DroneBookingDashboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("dr_bookings")
    .select("human_id,status,start_time,end_time,shop_id,drone_id,rental_fee_myr,deposit_myr")
    .eq("secure_token", token)
    .maybeSingle();
  if (!booking) notFound();

  const [{ data: shop }, { data: drone }] = await Promise.all([
    supabase.from("dr_shops").select("name,address,google_maps_url").eq("id", booking.shop_id).single(),
    supabase.from("dr_drones").select("human_id").eq("id", booking.drone_id).single(),
  ]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wide text-zinc-400">Booking {booking.human_id}</p>
        <h1 className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">
          {STATUS_LABELS[booking.status] ?? booking.status}
        </h1>
      </div>

      {booking.status === "CONFIRMED" && (
        <div className="rounded-xl border border-zinc-200 p-4 text-center dark:border-zinc-800">
          <p className="text-base font-medium text-black dark:text-zinc-50">
            Booking completed. Please collect at {shop?.name ?? "the shop"}.
          </p>
          {shop?.google_maps_url && (
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
        <Row label="Includes" value="Drone, RC-N3 controller, 2 batteries" />
        <Row label="Start" value={formatMalaysiaTime(new Date(booking.start_time), "en")} />
        <Row label="Return by" value={formatMalaysiaTime(new Date(booking.end_time), "en")} />
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

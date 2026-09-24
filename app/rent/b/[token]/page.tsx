import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { formatMalaysiaTime } from "@/lib/i18n/locale";

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  CONFIRMED: "Confirmed",
  ACTIVE: "Rental in progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const STATUS_MESSAGES: Record<string, string> = {
  CONFIRMED: "You're all set — just show up at the shop, no self check-in needed. Our staff will hand over the drone and walk you through everything.",
  ACTIVE: "Enjoy your flight! Bring the drone and batteries back to the shop by your return time.",
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
    supabase.from("dr_shops").select("name,address").eq("id", booking.shop_id).single(),
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
        <Row label="Start" value={formatMalaysiaTime(new Date(booking.start_time), "en")} />
        <Row label="Return by" value={formatMalaysiaTime(new Date(booking.end_time), "en")} />
        <Row label="Rental fee" value={`RM${booking.rental_fee_myr}`} />
        <Row label="Deposit (refundable)" value={`RM${booking.deposit_myr}`} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";

const STATUS_MESSAGES: Record<string, string> = {
  PENDING_PAYMENT: "Payment hasn't been completed yet.",
  CONFIRMED: "You're all set. Show this page at reception to pick up your camera.",
  READY_FOR_PICKUP: "Your camera is ready. Show this page at reception to pick it up.",
  ACTIVE: "Your rental is in progress. Enjoy!",
  RETURN_STARTED: "Please hand the camera pouch to reception now.",
  AWAITING_INSPECTION: "Thanks for returning your camera. Your deposit is held until ProCam staff inspect it.",
  INSPECTION: "Your camera is being inspected now.",
  DAMAGE_REVIEW: "An issue was found during inspection. Our team will be in touch about your deposit.",
  COMPLETED: "This rental is complete. Thanks for renting with ProCam!",
  CANCELLED: "This booking was cancelled.",
  EXPIRED: "This booking expired before payment was completed.",
};

export default async function RentalDashboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "human_id,status,start_time,end_time,partner_id,rental_package_id,camera_id,kit_id"
    )
    .eq("secure_token", token)
    .maybeSingle();

  if (!booking) notFound();

  const [{ data: partner }, { data: pkg }, { data: camera }, { data: kit }] = await Promise.all([
    supabase.from("partners").select("name,address").eq("id", booking.partner_id).single(),
    supabase.from("rental_packages").select("name").eq("id", booking.rental_package_id).single(),
    supabase.from("cameras").select("human_id").eq("id", booking.camera_id).single(),
    supabase.from("kits").select("human_id").eq("id", booking.kit_id).single(),
  ]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wide text-zinc-400">Booking {booking.human_id}</p>
        <h1 className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">{booking.status.replace(/_/g, " ")}</h1>
      </div>

      <p className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        {STATUS_MESSAGES[booking.status] ?? ""}
      </p>

      {booking.status === "PENDING_PAYMENT" && (
        <Link
          href={`/r/${token}/pay`}
          className="flex h-12 items-center justify-center rounded-full bg-black text-sm font-semibold text-white dark:bg-white dark:text-black"
        >
          Complete Payment
        </Link>
      )}

      {booking.status === "READY_FOR_PICKUP" && (
        <Link
          href={`/r/${token}/pickup`}
          className="flex h-12 items-center justify-center rounded-full bg-black text-sm font-semibold text-white dark:bg-white dark:text-black"
        >
          Start Pickup Check
        </Link>
      )}

      {booking.status === "ACTIVE" && (
        <Link
          href={`/r/${token}/return`}
          className="flex h-12 items-center justify-center rounded-full bg-black text-sm font-semibold text-white dark:bg-white dark:text-black"
        >
          Begin Return
        </Link>
      )}

      <div className="space-y-2 rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <Row label="Property" value={partner?.name ?? "—"} />
        <Row label="Package" value={pkg?.name ?? "—"} />
        <Row label="Camera" value={camera?.human_id ?? "—"} />
        <Row label="Kit" value={kit?.human_id ?? "—"} />
        <Row label="Start" value={new Date(booking.start_time).toLocaleString()} />
        <Row label="Return by" value={new Date(booking.end_time).toLocaleString()} />
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatDateTime } from "@/lib/i18n/locale";
import { RatingPrompt } from "./RatingPrompt";

const RATEABLE_STATUSES = ["AWAITING_INSPECTION", "INSPECTION", "DAMAGE_REVIEW", "COMPLETED"];

export default async function RentalDashboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("human_id,status,start_time,end_time,partner_id,dropoff_partner_id,rental_package_id,asset_id,rating")
    .eq("secure_token", token)
    .maybeSingle();

  if (!booking) notFound();

  const startTime = new Date(booking.start_time);
  const pickupIsAvailableNow = booking.status === "READY_FOR_PICKUP" || (booking.status === "CONFIRMED" && startTime <= new Date());
  const confirmedMessage =
    booking.status === "CONFIRMED" && !pickupIsAvailableNow
      ? dict.dashboard.confirmedAt(formatDateTime(startTime, locale))
      : dict.dashboard.confirmedNow;

  const isOneWay = booking.dropoff_partner_id !== booking.partner_id;
  const [{ data: partner }, { data: dropoffPartner }, { data: pkg }, { data: asset }] = await Promise.all([
    supabase.from("partners").select("name,address").eq("id", booking.partner_id).single(),
    isOneWay
      ? supabase.from("partners").select("name").eq("id", booking.dropoff_partner_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("rental_packages").select("name").eq("id", booking.rental_package_id).single(),
    supabase.from("rental_assets").select("human_id").eq("id", booking.asset_id).single(),
  ]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wide text-zinc-400">{dict.dashboard.bookingLabel(booking.human_id)}</p>
        <h1 className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">
          {dict.dashboard.statusLabels[booking.status] ?? booking.status.replace(/_/g, " ")}
        </h1>
      </div>

      <p className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        {booking.status === "CONFIRMED" ? confirmedMessage : (dict.dashboard.statusMessages[booking.status] ?? "")}
      </p>

      {booking.status === "PENDING_PAYMENT" && (
        <Link
          href={`/r/${token}/pay`}
          className="flex h-12 items-center justify-center rounded-full bg-black text-sm font-semibold text-white dark:bg-white dark:text-black"
        >
          {dict.dashboard.completePayment}
        </Link>
      )}

      {pickupIsAvailableNow && (
        <Link
          href={`/r/${token}/pickup`}
          className="flex h-12 items-center justify-center rounded-full bg-black text-sm font-semibold text-white dark:bg-white dark:text-black"
        >
          {dict.dashboard.startPickupCheck}
        </Link>
      )}

      {booking.status === "ACTIVE" && (
        <>
          <Link
            href={`/r/${token}/instructions`}
            className="flex h-12 items-center justify-center rounded-full border border-zinc-300 text-sm font-semibold dark:border-zinc-700"
          >
            {dict.dashboard.viewInstructions}
          </Link>
          <Link
            href={`/r/${token}/return`}
            className="flex h-12 items-center justify-center rounded-full bg-black text-sm font-semibold text-white dark:bg-white dark:text-black"
          >
            {dict.dashboard.beginReturn}
          </Link>
        </>
      )}

      {RATEABLE_STATUSES.includes(booking.status) && booking.rating === null && <RatingPrompt token={token} locale={locale} />}

      <div className="space-y-2 rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <Row label={dict.dashboard.row.pickup} value={partner?.name ?? "—"} />
        {isOneWay && <Row label={dict.dashboard.row.dropoff} value={dropoffPartner?.name ?? "—"} />}
        <Row label={dict.dashboard.row.package} value={pkg?.name ?? "—"} />
        <Row label={dict.dashboard.row.equipment} value={asset?.human_id ?? "—"} />
        <Row label={dict.dashboard.row.start} value={formatDateTime(new Date(booking.start_time), locale)} />
        <Row label={dict.dashboard.row.returnBy} value={formatDateTime(new Date(booking.end_time), locale)} />
      </div>

      <Link href="/terms" className="text-center text-xs text-zinc-400 underline underline-offset-2">
        {dict.common.termsAndConditions}
      </Link>
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

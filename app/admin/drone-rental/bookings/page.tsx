import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import { formatMyr } from "@/lib/droneRental/pricingRules";
import { REFERRER_SHARE } from "@/lib/referral";
import { loadFlyerBookings } from "@/lib/referralStats";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  CONFIRMED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  ACTIVE: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  CANCELLED: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  EXPIRED: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const PAID_STATUSES = ["CONFIRMED", "ACTIVE", "COMPLETED"];

/** 00:00 on the 1st of the current month in Malaysia time (UTC+8), as an ISO instant. */
function startOfMalaysiaMonthIso(now: Date): string {
  const shifted = new Date(now.getTime() + 8 * 60 * 60_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - 8 * 60 * 60_000).toISOString();
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-100 p-3 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-black dark:text-zinc-50">{value}</p>
    </div>
  );
}

/** The day to day of drone rental: this month in numbers and the latest bookings. Damage to decide on is one tap away. */
export default async function DroneBookingsPage() {
  const supabase = await createServerSupabaseClient();
  const monthStart = startOfMalaysiaMonthIso(new Date());
  const [{ count: damagePending }, { data: shops }, { data: drones }, { data: recent }, { data: monthBookings }, flyerBookings, { data: flyers }] = await Promise.all([
    supabase.from("dr_bookings").select("id", { count: "exact", head: true }).eq("damage_review", "PENDING"),
    supabase.from("dr_shops").select("id,name,active"),
    supabase.from("dr_drones").select("id,human_id,status"),
    supabase
      .from("dr_bookings")
      .select("id,human_id,status,source,start_time,end_time,rental_fee_myr,drone_charge_myr,controller_charge_myr,customer_id,shop_id,drone_id,referrer_id")
      .order("created_at", { ascending: false })
      .limit(25),
    supabase.from("dr_bookings").select("id,status,rental_fee_myr,referrer_id").gte("created_at", monthStart),
    loadFlyerBookings(),
    supabase.from("dr_referrers").select("id,name"),
  ]);
  const flyerName = new Map((flyers ?? []).map((f) => [f.id, f.name]));

  const customerIds = [...new Set((recent ?? []).map((b) => b.customer_id))];
  const { data: customers } = customerIds.length
    ? await supabase.from("customers").select("id,name,phone").in("id", customerIds)
    : { data: [] as { id: string; name: string; phone: string }[] };
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));
  const shopNameById = new Map((shops ?? []).map((s) => [s.id, s.name]));
  const droneHumanById = new Map((drones ?? []).map((d) => [d.id, d.human_id]));

  const paidThisMonth = (monthBookings ?? []).filter((b) => PAID_STATUSES.includes(b.status));
  const feesThisMonth = paidThisMonth.reduce((sum, b) => sum + Number(b.rental_fee_myr), 0);
  // Paid bookings this month that came from a flyer, and the flyer places' 10% on them.
  const flyerThisMonth = paidThisMonth.filter((b) => b.referrer_id);
  const flyerCommissionThisMonth = flyerThisMonth.reduce((sum, b) => sum + (flyerBookings.get(b.id)?.commission ?? 0), 0);
  const outNow = (drones ?? []).filter((d) => d.status === "RENTED").length;
  const activeDrones = (drones ?? []).filter((d) => d.status !== "RETIRED" && d.status !== "LOST").length;

  return (
    <div className="space-y-6 pt-4">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Paid bookings this month" value={String(paidThisMonth.length)} />
        <Stat label="Rental fees this month" value={formatMyr(feesThisMonth)} />
        <Stat label="Drones out now" value={`${outNow} of ${activeDrones}`} />
        <Stat label="Locations open to customers" value={String((shops ?? []).filter((s) => s.active).length)} />
        <Stat label="From flyers this month" value={`${flyerThisMonth.length} paid`} />
        <Stat label={`Flyer commission (${Math.round(REFERRER_SHARE * 100)}%) this month`} value={formatMyr(Math.round(flyerCommissionThisMonth * 100) / 100)} />
      </section>

      <Link
        href="/admin/drone-rental/damage"
        className="flex min-h-12 items-center justify-between rounded-xl border border-zinc-200 p-4 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
      >
        <span>
          <span className="block font-medium text-black dark:text-zinc-50">Damage review{damagePending ? ` · ${damagePending} waiting` : ""}</span>
          <span className="block text-sm text-zinc-500">Type the amount to keep for each damaged item and capture it from the deposit</span>
        </span>
        <span aria-hidden className="text-zinc-400">→</span>
      </Link>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Latest bookings</h2>
        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
          {(recent ?? []).map((b) => {
            const customer = customerById.get(b.customer_id);
            const kept = Number(b.drone_charge_myr) + Number(b.controller_charge_myr);
            return (
              <div key={b.id} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">
                    {customer?.name ?? "—"} <span className="font-normal text-zinc-400">· {b.human_id}</span>
                  </p>
                  <p className="text-xs text-zinc-500">
                    {shopNameById.get(b.shop_id) ?? "—"} · {droneHumanById.get(b.drone_id) ?? "—"} · {formatMalaysiaTime(new Date(b.start_time), "en")} to{" "}
                    {formatMalaysiaTime(new Date(b.end_time), "en")}
                    {b.source === "MERCHANT_INSTANT" ? " · walk-in" : ""}
                  </p>
                  {b.referrer_id && (
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Flyer: {flyerName.get(b.referrer_id) ?? "—"}
                      {flyerBookings.get(b.id) ? ` · ${formatMyr(flyerBookings.get(b.id)!.commission)} commission (${Math.round(REFERRER_SHARE * 100)}% of the profit)` : ` · ${Math.round(REFERRER_SHARE * 100)}% of the profit once paid`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {kept > 0 && <span className="text-xs text-red-600">Kept {formatMyr(kept)}</span>}
                  <span className="text-sm font-medium">{formatMyr(Number(b.rental_fee_myr))}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[b.status] ?? ""}`}>{b.status.replace("_", " ")}</span>
                </div>
              </div>
            );
          })}
          {(recent ?? []).length === 0 && <p className="p-4 text-sm text-zinc-400">No bookings yet.</p>}
        </div>
      </section>
    </div>
  );
}

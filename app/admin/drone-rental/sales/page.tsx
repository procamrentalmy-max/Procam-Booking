import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MAX_RENTAL_HOURS, MIN_RENTAL_HOURS, hourlyRateFor, includesController, modelProfile } from "@/lib/droneRental/pricingRules";
import { BarChart, DonutChart, Heatmap } from "../../sales/charts";

// Drone rental only: reads the dr_* tables and nothing else, so the old locker/camera sales page (/admin/sales) and its
// data stay exactly as they were and never mix into these numbers.

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MYT_OFFSET_MS = 8 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** A booking counts as a sale once it is paid. Everything after that (return, damage) is still a sale. */
const PAID_STATUSES = ["CONFIRMED", "ACTIVE", "COMPLETED"];
const NOT_COMPLETED_STATUSES = ["CANCELLED", "EXPIRED"];

/** Shop hours are 08:00 to 22:00 Malaysia time, so these are the hour-of-day bars worth drawing. */
const OPEN_HOUR = 8;
const CLOSE_HOUR = 22;
const OPEN_HOURS_PER_DAY = CLOSE_HOUR - OPEN_HOUR;

const RANGES = [
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "90d", label: "Last 90 days" },
  { key: "all", label: "All time" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

function myr(n: number): string {
  return `RM${n.toLocaleString("en-MY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Year, month, weekday and hour of an instant as seen on a clock in Malaysia (UTC+8), whatever the server's timezone. */
function mytParts(iso: string) {
  const d = new Date(new Date(iso).getTime() + MYT_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDay(), hour: d.getUTCHours() };
}

function rangeStartMs(range: RangeKey, now: number): number | null {
  if (range === "all") return null;
  if (range === "30d") return now - 30 * DAY_MS;
  if (range === "90d") return now - 90 * DAY_MS;
  const shifted = new Date(now + MYT_OFFSET_MS);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - MYT_OFFSET_MS;
}

type Money = { count: number; revenue: number };
const bump = (map: Map<string, Money>, key: string, revenue: number) => {
  const entry = map.get(key) ?? { count: 0, revenue: 0 };
  entry.count += 1;
  entry.revenue += revenue;
  map.set(key, entry);
};

export default async function DroneSalesPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeParam } = await searchParams;
  const range: RangeKey = RANGES.some((r) => r.key === rangeParam) ? (rangeParam as RangeKey) : "30d";

  const supabase = await createServerSupabaseClient();
  const [{ data: bookings }, { data: shops }, { data: drones }, { data: swaps }, { data: lateFees }] = await Promise.all([
    supabase
      .from("dr_bookings")
      .select(
        "id,status,source,customer_id,shop_id,drone_id,start_time,end_time,batteries_count,drone_model,with_controller,rental_fee_myr,drone_charge_myr,controller_charge_myr,drone_outcome,controller_outcome",
      ),
    supabase.from("dr_shops").select("id,name"),
    supabase.from("dr_drones").select("id,human_id,shop_id,status,cost_price_myr,model_key"),
    supabase.from("dr_battery_swaps").select("booking_id,fee_myr"),
    supabase.from("dr_payments").select("booking_id,amount_myr").eq("kind", "LATE_FEE").eq("status", "SUCCEEDED"),
  ]);

  const now = new Date().getTime();
  const fromMs = rangeStartMs(range, now);
  const shopName = new Map((shops ?? []).map((s) => [s.id, s.name]));

  // Money beyond the rental fee, per booking.
  const swapFeeByBooking = new Map<string, number>();
  for (const s of swaps ?? []) swapFeeByBooking.set(s.booking_id, (swapFeeByBooking.get(s.booking_id) ?? 0) + Number(s.fee_myr));
  const lateFeeByBooking = new Map<string, number>();
  for (const p of lateFees ?? []) lateFeeByBooking.set(p.booking_id, (lateFeeByBooking.get(p.booking_id) ?? 0) + Number(p.amount_myr));

  const parts = (b: NonNullable<typeof bookings>[number]) => {
    const rental = Number(b.rental_fee_myr);
    const swap = swapFeeByBooking.get(b.id) ?? 0;
    const late = lateFeeByBooking.get(b.id) ?? 0;
    const kept = Number(b.drone_charge_myr) + Number(b.controller_charge_myr);
    return { rental, swap, late, kept, total: rental + swap + late + kept };
  };

  const everything = bookings ?? [];
  const inRange = everything.filter((b) => fromMs === null || new Date(b.start_time).getTime() >= fromMs);
  const paid = inRange.filter((b) => PAID_STATUSES.includes(b.status));
  const notCompleted = inRange.filter((b) => NOT_COMPLETED_STATUSES.includes(b.status));
  const decided = inRange.filter((b) => b.status !== "PENDING_PAYMENT");

  const breakdown = { rental: 0, swap: 0, late: 0, kept: 0 };
  const byShop = new Map<string, Money>();
  const byDrone = new Map<string, Money & { hours: number }>();
  const byMonth = new Map<string, Money & { year: number; month: number }>();
  const byLength = new Map<string, Money>();
  const byBatteries = new Map<string, Money>();
  const byModel = new Map<string, Money>();
  const byController = new Map<string, Money>();
  const bySource = new Map<string, Money>();
  const hourCounts = Array<number>(24).fill(0);
  const shopByDay = new Map<string, number[]>();
  const bookingsByCustomer = new Map<string, number>();
  let usedHours = 0;

  for (const b of paid) {
    const p = parts(b);
    breakdown.rental += p.rental;
    breakdown.swap += p.swap;
    breakdown.late += p.late;
    breakdown.kept += p.kept;

    const when = mytParts(b.start_time);
    const hours = Math.max(0, (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3_600_000);

    bump(byShop, b.shop_id, p.total);
    const drone = byDrone.get(b.drone_id) ?? { count: 0, revenue: 0, hours: 0 };
    drone.count += 1;
    drone.revenue += p.total;
    drone.hours += hours;
    byDrone.set(b.drone_id, drone);

    const monthKey = `${when.year}-${String(when.month + 1).padStart(2, "0")}`;
    const month = byMonth.get(monthKey) ?? { count: 0, revenue: 0, year: when.year, month: when.month };
    month.count += 1;
    month.revenue += p.total;
    byMonth.set(monthKey, month);

    // Paid length, worked back from the rental fee (walk-ins end on a rounded time, so end minus start isn't what was paid for).
    const profile = modelProfile(b.drone_model);
    const batteryFee = profile.batteryFeeMyr[b.batteries_count as 1 | 2] ?? 0;
    const paidHours = (p.rental - batteryFee) / hourlyRateFor(b.drone_model, b.with_controller);
    const validLength = Number.isInteger(paidHours) && paidHours >= MIN_RENTAL_HOURS && paidHours <= MAX_RENTAL_HOURS;
    bump(byLength, validLength ? `${paidHours} hour${paidHours === 1 ? "" : "s"}` : "Other", p.total);

    bump(byModel, profile.shortName, p.total);
    if (profile.controllerOptional) bump(byController, includesController(b.drone_model, b.with_controller) ? "With controller" : "Drone only", p.total);
    bump(byBatteries, `${b.batteries_count} ${b.batteries_count === 1 ? "battery" : "batteries"}`, p.total);
    bump(bySource, b.source === "MERCHANT_INSTANT" ? "Walk-in at the shop" : "Booked online", p.total);

    hourCounts[when.hour] += 1;
    const days = shopByDay.get(b.shop_id) ?? Array<number>(7).fill(0);
    days[when.day] += p.total;
    shopByDay.set(b.shop_id, days);

    bookingsByCustomer.set(b.customer_id, (bookingsByCustomer.get(b.customer_id) ?? 0) + 1);
    if (new Date(b.start_time).getTime() <= now) usedHours += hours;
  }

  const totalRevenue = breakdown.rental + breakdown.swap + breakdown.late + breakdown.kept;
  const avgPerBooking = paid.length ? totalRevenue / paid.length : 0;
  const notCompletedRate = decided.length ? notCompleted.length / decided.length : 0;

  // Utilisation: hours drones were out against the hours they could have been out (open hours x working drones x days).
  const workingDrones = (drones ?? []).filter((d) => d.status !== "RETIRED" && d.status !== "LOST").length;
  const earliest = everything.length ? Math.min(...everything.map((b) => new Date(b.start_time).getTime())) : now;
  const windowStart = fromMs ?? earliest;
  const windowDays = Math.max(1, (now - windowStart) / DAY_MS);
  const capacityHours = workingDrones * OPEN_HOURS_PER_DAY * windowDays;
  const utilisation = capacityHours ? Math.min(1, usedHours / capacityHours) : 0;

  const repeatCustomers = [...bookingsByCustomer.values()].filter((n) => n > 1).length;

  // Payback is lifetime, not just the chosen range: how much of its purchase price each drone has earned back.
  const lifetimeByDrone = new Map<string, number>();
  for (const b of everything) {
    if (!PAID_STATUSES.includes(b.status)) continue;
    lifetimeByDrone.set(b.drone_id, (lifetimeByDrone.get(b.drone_id) ?? 0) + parts(b).total);
  }

  const shopRows = [...byShop.entries()]
    .map(([id, v]) => ({ id, name: shopName.get(id) ?? "Unknown shop", ...v }))
    .sort((a, b) => b.revenue - a.revenue);
  const droneRows = (drones ?? [])
    .map((d) => {
      const v = byDrone.get(d.id) ?? { count: 0, revenue: 0, hours: 0 };
      const lifetime = lifetimeByDrone.get(d.id) ?? 0;
      const cost = Number(d.cost_price_myr);
      return { ...d, ...v, lifetime, paybackPct: cost > 0 ? lifetime / cost : null };
    })
    .sort((a, b) => b.revenue - a.revenue);
  const monthRows = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, v]) => ({ key, label: `${MONTH_NAMES[v.month]} ${v.year}`, ...v }));
  const lengthRows = [...byLength.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const batteryRows = [...byBatteries.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue);
  const controllerRows = [...byController.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue);
  const modelRows = [...byModel.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue);
  const sourceRows = [...bySource.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue);
  const hourRows = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i).map((h) => ({ label: `${String(h).padStart(2, "0")}:00`, value: hourCounts[h] }));

  const deposit = depositOutcomes(inRange.filter((b) => b.status === "COMPLETED"));
  const rangeLabel = RANGES.find((r) => r.key === range)!.label.toLowerCase();

  return (
    <div className="space-y-8 pt-2 pb-10">
      <div className="space-y-3">
        <Link href="/admin/drone-rental" className="inline-flex min-h-10 items-center text-sm font-medium text-zinc-600 dark:text-zinc-400">
          ← Drone Rental
        </Link>
        <p className="text-sm text-zinc-500">
          Drone rental only. Counts every booking that reached payment ({paid.length} of {inRange.length} bookings, {rangeLabel}). Revenue is the rental fee plus battery swaps, late fees and any deposit kept for damage or loss.
        </p>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/admin/drone-rental/sales?range=${r.key}`}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium ${
                r.key === range ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Revenue" value={myr(totalRevenue)} />
        <Card label="Paid bookings" value={String(paid.length)} sub={paid.length ? `${myr(avgPerBooking)} each on average` : undefined} />
        <Card label="Drone utilisation" value={`${Math.round(utilisation * 100)}%`} sub={`${Math.round(usedHours)} h out of ${Math.round(capacityHours)} h open`} />
        <Card label="Not completed" value={`${Math.round(notCompletedRate * 100)}%`} sub={`${notCompleted.length} cancelled or expired of ${decided.length}`} />
      </div>

      <Section title="Where the money comes from" note="Rental fees include the battery choice. Deposit kept is only what was actually taken for damaged or lost items.">
        <DonutChart
          data={[
            { label: "Rental fees", value: breakdown.rental },
            { label: "Battery swaps", value: breakdown.swap },
            { label: "Late fees", value: breakdown.late },
            { label: "Deposit kept (damage or loss)", value: breakdown.kept },
          ].filter((d) => d.value > 0)}
          formatValue={myr}
        />
      </Section>

      <Section title="By month" note="Which months sell best. Months are counted on Malaysia time, by the day the rental starts.">
        <BarChart data={monthRows.map((m) => ({ label: m.label, value: m.revenue }))} formatValue={myr} />
        <Table columns={["Month", "Revenue", "Bookings"]} rows={monthRows.map((m) => [m.label, myr(m.revenue), String(m.count)])} />
      </Section>

      <Section title="By drone model" note="Neo 2 and GT50 side by side.">
        <DonutChart data={modelRows.map((r) => ({ label: r.name, value: r.revenue }))} formatValue={myr} />
        <Table
          columns={["Model", "Bookings", "Revenue", "Average booking"]}
          rows={modelRows.map((r) => [r.name, String(r.count), myr(r.revenue), myr(r.count ? r.revenue / r.count : 0)])}
        />
      </Section>

      <Section title="Drone only or with controller" note="Neo 2 rentals: with the RC-N3 controller (RM5 an hour more) or flown from the customer's own phone.">
        <DonutChart data={controllerRows.map((r) => ({ label: r.name, value: r.revenue }))} formatValue={myr} />
      </Section>

      <Section title="By shop">
        <BarChart data={shopRows.map((s) => ({ label: s.name, value: s.revenue }))} formatValue={myr} />
        <Table
          columns={["Shop", "Revenue", "Bookings", "Average booking"]}
          rows={shopRows.map((s) => [s.name, myr(s.revenue), String(s.count), myr(s.count ? s.revenue / s.count : 0)])}
        />
      </Section>

      <Section title="By drone" note="Payback is everything the drone has earned since the start, against what it cost to buy.">
        <Table
          columns={["Drone", "Shop", "Bookings", "Hours out", "Revenue", "Earned so far", "Paid back"]}
          rows={droneRows.map((d) => [
            `${d.human_id} · ${modelProfile(d.model_key).shortName}`,
            shopName.get(d.shop_id) ?? "—",
            String(d.count),
            `${Math.round(d.hours * 10) / 10}`,
            myr(d.revenue),
            myr(d.lifetime),
            d.paybackPct != null ? `${Math.round(d.paybackPct * 100)}%` : "—",
          ])}
        />
      </Section>

      <Section title="Busiest days at each shop" note="Darker is more revenue that weekday, compared with this table's own best cell.">
        <Heatmap
          rowLabel="Shop"
          rows={shopRows.map((s) => s.name)}
          columns={DAY_NAMES}
          values={shopRows.map((s) => shopByDay.get(s.id) ?? Array<number>(7).fill(0))}
          formatValue={myr}
        />
      </Section>

      <Section title="When rentals start" note="Number of rentals starting in each hour of the day, Malaysia time.">
        <BarChart data={hourRows} formatValue={(n) => String(n)} />
      </Section>

      <Section title="How long people rent for">
        <BarChart data={lengthRows.map((l) => ({ label: l.name, value: l.revenue }))} formatValue={myr} />
        <Table
          columns={["Length", "Bookings", "Revenue", "% of revenue"]}
          rows={lengthRows.map((l) => [l.name, String(l.count), myr(l.revenue), totalRevenue ? `${Math.round((l.revenue / totalRevenue) * 100)}%` : "—"])}
        />
      </Section>

      <div className="grid gap-8 sm:grid-cols-2">
        <Section title="1 battery or 2">
          <DonutChart data={batteryRows.map((r) => ({ label: r.name, value: r.revenue }))} formatValue={myr} />
        </Section>
        <Section title="Online or walk-in">
          <DonutChart data={sourceRows.map((r) => ({ label: r.name, value: r.revenue }))} formatValue={myr} />
        </Section>
      </div>

      <Section title="Returns and deposits" note="Completed rentals only. Fine means nothing was taken from the deposit.">
        <Table
          columns={["Item", "Fine", "Damaged", "Lost"]}
          rows={[
            ["Drone", String(deposit.drone.fine), String(deposit.drone.damaged), String(deposit.drone.lost)],
            ["Controller", String(deposit.controller.fine), String(deposit.controller.damaged), String(deposit.controller.lost)],
          ]}
        />
        <p className="text-sm text-zinc-500">
          Deposit kept in this period: <span className="font-medium text-black dark:text-zinc-50">{myr(breakdown.kept)}</span> · Late fees: <span className="font-medium text-black dark:text-zinc-50">{myr(breakdown.late)}</span>
        </p>
      </Section>

      <Section title="Customers">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {bookingsByCustomer.size} customer{bookingsByCustomer.size === 1 ? "" : "s"} rented {rangeLabel}; {repeatCustomers} of them came back for more than one rental.
        </p>
      </Section>
    </div>
  );
}

function depositOutcomes(completed: { drone_outcome: string; controller_outcome: string }[]) {
  const count = (field: "drone_outcome" | "controller_outcome") => ({
    fine: completed.filter((b) => b[field] === "NONE").length,
    damaged: completed.filter((b) => b[field] === "DAMAGED").length,
    lost: completed.filter((b) => b[field] === "LOST").length,
  });
  return { drone: count("drone_outcome"), controller: count("controller_outcome") };
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold text-zinc-500">{title}</h2>
        {note && <p className="text-xs text-zinc-400">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Table({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 dark:bg-zinc-900">
            {columns.map((c, i) => (
              <th key={c} className={`px-3 py-2 font-medium text-zinc-500 ${i === 0 ? "text-left" : "text-right"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
              {row.map((cell, j) => (
                <td key={j} className={`px-3 py-2 ${j === 0 ? "text-left" : "text-right"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-3 text-center text-zinc-400">
                No data yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

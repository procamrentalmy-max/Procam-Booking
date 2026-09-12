import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BarChart, Heatmap, DonutChart } from "./charts";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Once a booking is past PENDING_PAYMENT, the rental fee has actually been charged — every later status still counts as a realized sale, whatever happens afterward (damage, late return, etc.). */
const REALIZED_STATUSES = [
  "CONFIRMED", "READY_FOR_PICKUP", "ACTIVE", "RETURN_STARTED",
  "AWAITING_INSPECTION", "INSPECTION", "DAMAGE_REVIEW", "COMPLETED",
];
const UNREALIZED_STATUSES = ["CANCELLED", "EXPIRED"];

/** The commission rate documented for partners — there's no commissions data actually written by the app yet, so this is computed rather than read. */
const COMMISSION_RATE = 0.2;

function myr(n: number): string {
  return `RM${n.toFixed(2)}`;
}

type Agg = {
  revenue: number;
  bookings: number;
  lateFee: number;
  ratingSum: number;
  ratingCount: number;
  byDay: number[];
  byPackage: Map<string, { count: number; revenue: number }>;
};

function emptyAgg(): Agg {
  return { revenue: 0, bookings: 0, lateFee: 0, ratingSum: 0, ratingCount: 0, byDay: Array(7).fill(0), byPackage: new Map() };
}

export default async function SalesPage() {
  const supabase = await createServerSupabaseClient();

  const [{ data: bookings }, { data: packages }, { data: products }, { data: partners }] = await Promise.all([
    supabase.from("bookings").select("id,partner_id,rental_package_id,status,start_time,late_fee_myr,rating"),
    supabase.from("rental_packages").select("id,name,price_myr,product_id"),
    supabase.from("rental_products").select("id,customer_facing_name"),
    supabase.from("partners").select("id,name"),
  ]);

  const packageById = new Map((packages ?? []).map((p) => [p.id, p]));
  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  const partnerById = new Map((partners ?? []).map((p) => [p.id, p]));

  const all = bookings ?? [];
  const realized = all.filter((b) => REALIZED_STATUSES.includes(b.status));
  const unrealized = all.filter((b) => UNREALIZED_STATUSES.includes(b.status));

  const rentalFeeFor = (b: { rental_package_id: string }) => Number(packageById.get(b.rental_package_id)?.price_myr ?? 0);

  const perLocker = new Map<string, Agg>();
  const byMonth = new Map<string, { revenue: number; bookings: number }>();
  const byPackageOverall = new Map<string, { count: number; revenue: number }>();
  const byProduct = new Map<string, { count: number; revenue: number }>();

  for (const b of realized) {
    const fee = rentalFeeFor(b);
    const pkgName = packageById.get(b.rental_package_id)?.name ?? "Unknown package";
    const start = new Date(b.start_time);

    const locker = perLocker.get(b.partner_id) ?? emptyAgg();
    locker.revenue += fee;
    locker.bookings += 1;
    locker.lateFee += Number(b.late_fee_myr) || 0;
    if (b.rating != null) {
      locker.ratingSum += b.rating;
      locker.ratingCount += 1;
    }
    locker.byDay[start.getDay()] += fee;
    const lockerPkg = locker.byPackage.get(pkgName) ?? { count: 0, revenue: 0 };
    lockerPkg.count += 1;
    lockerPkg.revenue += fee;
    locker.byPackage.set(pkgName, lockerPkg);
    perLocker.set(b.partner_id, locker);

    const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    const month = byMonth.get(monthKey) ?? { revenue: 0, bookings: 0 };
    month.revenue += fee;
    month.bookings += 1;
    byMonth.set(monthKey, month);

    const overallPkg = byPackageOverall.get(pkgName) ?? { count: 0, revenue: 0 };
    overallPkg.count += 1;
    overallPkg.revenue += fee;
    byPackageOverall.set(pkgName, overallPkg);

    const pkg = packageById.get(b.rental_package_id);
    const productName = pkg ? (productById.get(pkg.product_id)?.customer_facing_name ?? "Unknown product") : "Unknown product";
    const prod = byProduct.get(productName) ?? { count: 0, revenue: 0 };
    prod.count += 1;
    prod.revenue += fee;
    byProduct.set(productName, prod);
  }

  const totalRevenue = realized.reduce((s, b) => s + rentalFeeFor(b), 0);
  const totalLateFee = realized.reduce((s, b) => s + (Number(b.late_fee_myr) || 0), 0);
  const overallRatingCount = realized.filter((b) => b.rating != null).length;
  const overallRatingSum = realized.reduce((s, b) => s + (b.rating ?? 0), 0);
  const cancellationRate = all.length ? unrealized.length / all.length : 0;

  const lockerRows = [...perLocker.entries()]
    .map(([partnerId, agg]) => {
      const bestDayIndex = agg.byDay.reduce((best, v, i) => (v > agg.byDay[best] ? i : best), 0);
      const topPackage = [...agg.byPackage.entries()].sort((a, b) => b[1].revenue - a[1].revenue)[0];
      return {
        partnerId,
        name: partnerById.get(partnerId)?.name ?? "Unknown locker",
        revenue: agg.revenue,
        bookings: agg.bookings,
        commission: agg.revenue * COMMISSION_RATE,
        avgRating: agg.ratingCount ? agg.ratingSum / agg.ratingCount : null,
        bestDay: agg.bookings ? DAY_NAMES[bestDayIndex] : "—",
        topPackage: topPackage?.[0] ?? "—",
        byDay: agg.byDay,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const monthRows = [...byMonth.entries()]
    .map(([key, v]) => {
      const [year, month] = key.split("-");
      return { key, label: `${MONTH_NAMES[Number(month) - 1]} ${year}`, ...v };
    })
    .sort((a, b) => b.revenue - a.revenue);
  // Chronological, not revenue-ranked — a trend chart needs time on the axis.
  const monthRowsChrono = [...monthRows].sort((a, b) => a.key.localeCompare(b.key));

  const packageRows = [...byPackageOverall.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  const productRows = [...byProduct.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-8 pt-4 pb-10">
      <div>
        <h1 className="text-lg font-semibold">Sales</h1>
        <p className="text-sm text-zinc-500">
          Rental-fee revenue from every booking that reached payment ({realized.length} of {all.length} bookings).
          Late fees, cancellations, and ratings shown separately.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Rental revenue" value={myr(totalRevenue)} />
        <Card label="Late fees collected" value={myr(totalLateFee)} />
        <Card
          label="Avg rating"
          value={overallRatingCount ? `${(overallRatingSum / overallRatingCount).toFixed(1)} / 5` : "No ratings yet"}
          sub={overallRatingCount ? `${overallRatingCount} rated` : undefined}
        />
        <Card label="Cancellation rate" value={`${(cancellationRate * 100).toFixed(0)}%`} sub={`${unrealized.length} of ${all.length}`} />
      </div>

      <Section title="By locker" note="Ranked by revenue. Commission is computed at 20% — nothing is read from the commissions table since it isn't written to yet.">
        <BarChart data={lockerRows.map((l) => ({ label: l.name, value: l.revenue }))} formatValue={myr} />
        <Table
          columns={["Locker", "Revenue", "Bookings", "Commission owed", "Avg rating", "Best day", "Top package"]}
          rows={lockerRows.map((l) => [
            l.name,
            myr(l.revenue),
            String(l.bookings),
            myr(l.commission),
            l.avgRating != null ? `${l.avgRating.toFixed(1)} / 5` : "—",
            l.bestDay,
            l.topPackage,
          ])}
        />
      </Section>

      <Section title="Revenue by day of week, per locker" note="Darker = more revenue that day, relative to this table's own busiest cell.">
        <Heatmap
          rowLabel="Locker"
          rows={lockerRows.map((l) => l.name)}
          columns={DAY_NAMES}
          values={lockerRows.map((l) => l.byDay)}
          formatValue={myr}
        />
      </Section>

      <Section title="By month" note="Which months sell best, across all lockers.">
        <BarChart data={monthRowsChrono.map((m) => ({ label: m.label, value: m.revenue }))} formatValue={myr} />
        <Table columns={["Month", "Revenue", "Bookings"]} rows={monthRows.map((m) => [m.label, myr(m.revenue), String(m.bookings)])} />
      </Section>

      <Section title="By package" note="Which duration/product package customers actually pick.">
        <BarChart data={packageRows.map((p) => ({ label: p.name, value: p.revenue }))} formatValue={myr} />
        <Table
          columns={["Package", "Bookings", "Revenue", "% of revenue"]}
          rows={packageRows.map((p) => [
            p.name,
            String(p.count),
            myr(p.revenue),
            totalRevenue ? `${((p.revenue / totalRevenue) * 100).toFixed(0)}%` : "—",
          ])}
        />
      </Section>

      <Section title="By product">
        <DonutChart data={productRows.map((p) => ({ label: p.name, value: p.revenue }))} formatValue={myr} />
        <Table
          columns={["Product", "Bookings", "Revenue"]}
          rows={productRows.map((p) => [p.name, String(p.count), myr(p.revenue)])}
        />
      </Section>
    </div>
  );
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

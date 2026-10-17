import { createServerSupabaseClient } from "@/lib/supabase/server";
import { modelProfile } from "@/lib/droneRental/pricingRules";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import { RankedBars } from "@/components/droneRental/DroneCharts";

export const dynamic = "force-dynamic";

const HOUR_MS = 3_600_000;

function hoursLabel(ms: number): string {
  const h = ms / HOUR_MS;
  return h >= 10 ? `${Math.round(h)} h` : `${(Math.round(h * 10) / 10).toFixed(1)} h`;
}

/**
 * Every drone battery in one list, numbered across all the shops (B1, B2... one running number per make), with how much each has been used:
 * how many times it went out with a customer (a first handout or a swap), how many hours it has spent out, and when it was last out.
 * The numbers are worked out from the handout and swap records, so they start counting from the first rental that is recorded.
 */
export default async function DroneBatteriesPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: batteries }, { data: shops }, { data: swaps }] = await Promise.all([
    supabase.from("dr_batteries").select("id,human_id,name,model_key,status,at_shop_id,current_booking_id").order("human_id"),
    supabase.from("dr_shops").select("id,name"),
    supabase.from("dr_battery_swaps").select("booking_id,released_battery_id,issued_battery_id,created_at").order("created_at"),
  ]);
  const bookingIds = [...new Set((swaps ?? []).map((s) => s.booking_id))];
  const { data: bookings } = bookingIds.length
    ? await supabase.from("dr_bookings").select("id,human_id,status,actual_return_time").in("id", bookingIds)
    : { data: [] as { id: string; human_id: string; status: string; actual_return_time: string | null }[] };

  const shopName = new Map((shops ?? []).map((s) => [s.id, s.name]));
  const bookingById = new Map((bookings ?? []).map((b) => [b.id, b]));
  const now = new Date().getTime();

  const rows = (batteries ?? []).map((b) => {
    const issues = (swaps ?? []).filter((s) => s.issued_battery_id === b.id);
    let outMs = 0;
    let lastMs = 0;
    for (const issue of issues) {
      const start = new Date(issue.created_at).getTime();
      const release = (swaps ?? []).find((s) => s.booking_id === issue.booking_id && s.released_battery_id === b.id && new Date(s.created_at).getTime() > start);
      const booking = bookingById.get(issue.booking_id);
      const end = release
        ? new Date(release.created_at).getTime()
        : booking?.actual_return_time
          ? new Date(booking.actual_return_time).getTime()
          : booking?.status === "ACTIVE"
            ? now
            : start;
      outMs += Math.max(0, end - start);
      lastMs = Math.max(lastMs, end);
    }
    const rentals = new Set(issues.map((i) => i.booking_id)).size;
    const swappedIn = issues.filter((i) => i.released_battery_id).length;
    const withBooking = b.current_booking_id ? bookingById.get(b.current_booking_id) : undefined;
    return {
      id: b.id,
      name: b.name ?? b.human_id,
      serial: b.human_id,
      make: modelProfile(b.model_key).shortName,
      where: b.status === "AT_SHOP" ? `At ${shopName.get(b.at_shop_id) ?? "a shop"}` : b.status === "WITH_CUSTOMER" ? `With a customer${withBooking ? ` (${withBooking.human_id})` : ""}` : b.status,
      uses: issues.length,
      rentals,
      swappedIn,
      outMs,
      lastMs,
    };
  });
  const sorted = [...rows].sort((a, b) => b.uses - a.uses || b.outMs - a.outMs || a.name.localeCompare(b.name, undefined, { numeric: true }));
  const totalUses = rows.reduce((n, r) => n + r.uses, 0);
  const totalOut = rows.reduce((n, r) => n + r.outMs, 0);
  const most = sorted[0];
  const fewest = [...rows].sort((a, b) => a.uses - b.uses || a.name.localeCompare(b.name, undefined, { numeric: true }))[0];

  return (
    <div className="space-y-6 pt-4 pb-10">
      <div>
        <h1 className="text-lg font-semibold">Drone batteries</h1>
        <p className="text-sm text-zinc-500">
          Every battery in one list, numbered across all the shops so no number repeats (one running number per make: B for the Neo 2, N for the Neo). Counts come from the handout and swap
          records, so they start with the first rental recorded.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Batteries", value: String(rows.length) },
          { label: "Times handed out", value: String(totalUses) },
          { label: "Hours out with customers", value: hoursLabel(totalOut) },
          { label: "Most used", value: most && most.uses > 0 ? `${most.name} · ${most.uses}×` : "—" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{c.label}</p>
            <p className="mt-0.5 text-xl font-semibold text-black dark:text-zinc-50">{c.value}</p>
          </div>
        ))}
      </div>
      {fewest && rows.length > 1 && most && most.uses > 0 && (
        <p className="text-xs text-zinc-500">
          Least used: <span className="font-medium">{fewest.name}</span> ({fewest.uses}×). Rotating the batteries that are used least keeps the wear even.
        </p>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-black dark:text-zinc-50">Ranking: most used first</h2>
          <p className="text-xs text-zinc-500">How many times each battery has gone out with a customer. Gold, silver and bronze are the three most used; the least used ones sit at the bottom, ready to be rotated in.</p>
        </div>
        <RankedBars rows={sorted.map((r) => ({ label: r.name, value: r.uses, note: r.uses === 1 ? "1 time" : `${r.uses} times` }))} format={(n) => `${n}×`} emptyText="No batteries yet." />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-black dark:text-zinc-50">Ranking: hours out with customers</h2>
          <p className="text-xs text-zinc-500">The same batteries ordered by how long they have spent out, which is what actually wears them.</p>
        </div>
        <RankedBars
          rows={[...rows].sort((a, b) => b.outMs - a.outMs || a.name.localeCompare(b.name, undefined, { numeric: true })).map((r) => ({ label: r.name, value: Math.round((r.outMs / HOUR_MS) * 10) / 10 }))}
          format={(n) => `${n} h`}
          emptyText="No batteries yet."
        />
      </section>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Battery</th>
              <th className="px-3 py-2">Serial</th>
              <th className="px-3 py-2">Make</th>
              <th className="px-3 py-2">Now</th>
              <th className="px-3 py-2 text-right">Times used</th>
              <th className="px-3 py-2 text-right">Rentals</th>
              <th className="px-3 py-2 text-right">Swapped in</th>
              <th className="px-3 py-2 text-right">Hours out</th>
              <th className="px-3 py-2">Last out</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-900">
                <td className="px-3 py-2 font-semibold text-black dark:text-zinc-50">{r.name}</td>
                <td className="px-3 py-2 text-zinc-500">{r.serial}</td>
                <td className="px-3 py-2">{r.make}</td>
                <td className="px-3 py-2">{r.where}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.uses}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.rentals}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.swappedIn}</td>
                <td className="px-3 py-2 text-right tabular-nums">{hoursLabel(r.outMs)}</td>
                <td className="px-3 py-2 text-zinc-500">{r.lastMs ? formatMalaysiaTime(new Date(r.lastMs), "en") : "never"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-zinc-500">
                  No batteries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Times used: how many times the battery went out with a customer, as a first handout or as a swap. Rentals: how many different rentals it was on. Swapped in: how many of those were swaps. Hours
        out: time with customers, from handout until it was swapped out or the drone came back.
      </p>
    </div>
  );
}

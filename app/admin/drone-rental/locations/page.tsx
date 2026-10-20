import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const RANGES = [
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "all", label: "Everything", days: null as number | null },
];

type Row = { session_id: string; shop_id: string; kind: "SELECT" | "OPEN" | "DIRECTIONS" };

/**
 * Traffic on the shop list, location by location: how many times each location was tapped (on the map or the list), how many times its page was
 * opened (Check Rates, Book here, or arriving straight on it), how many asked for directions, and how many different visits did any of it.
 * A visit is a random id from the browser tab, nothing that identifies a person; the admin's own testing is not counted.
 */
export default async function LocationTrafficPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeParam } = await searchParams;
  const range = RANGES.find((r) => r.key === rangeParam) ?? RANGES[1];
  const supabase = await createServerSupabaseClient();

  const since = range.days ? new Date(new Date().getTime() - range.days * 86_400_000).toISOString() : null;
  const events: Row[] = [];
  // The database hands back at most 1000 rows at a time, so read the period page by page.
  for (let from = 0; from < 200_000; from += 1000) {
    let q = supabase.from("dr_location_events").select("session_id,shop_id,kind").order("created_at", { ascending: true }).range(from, from + 999);
    if (since) q = q.gte("created_at", since);
    const { data } = await q;
    events.push(...((data ?? []) as Row[]));
    if ((data ?? []).length < 1000) break;
  }
  const { data: shops } = await supabase.from("dr_shops").select("id,name,human_id,active");

  type Count = { taps: number; opens: number; directions: number; visits: Set<string>; openers: Set<string> };
  const byShop = new Map<string, Count>();
  const allVisits = new Set<string>();
  const allOpeners = new Set<string>();
  for (const e of events) {
    let c = byShop.get(e.shop_id);
    if (!c) byShop.set(e.shop_id, (c = { taps: 0, opens: 0, directions: 0, visits: new Set(), openers: new Set() }));
    c.visits.add(e.session_id);
    allVisits.add(e.session_id);
    if (e.kind === "SELECT") c.taps++;
    if (e.kind === "OPEN") {
      c.opens++;
      c.openers.add(e.session_id);
      allOpeners.add(e.session_id);
    }
    if (e.kind === "DIRECTIONS") c.directions++;
  }

  const rows = (shops ?? [])
    .map((s) => {
      const c = byShop.get(s.id);
      return { id: s.id, name: s.name, humanId: s.human_id, active: s.active, taps: c?.taps ?? 0, opens: c?.opens ?? 0, directions: c?.directions ?? 0, people: c?.visits.size ?? 0, openedBy: c?.openers.size ?? 0 };
    })
    .sort((a, b) => b.taps + b.opens - (a.taps + a.opens) || b.people - a.people || a.name.localeCompare(b.name));
  const touched = rows.filter((r) => r.taps + r.opens + r.directions > 0);
  const top = touched[0];
  const total = (key: "taps" | "opens" | "directions") => rows.reduce((n, r) => n + r[key], 0);
  const maxScore = Math.max(1, ...rows.map((r) => r.taps + r.opens));

  return (
    <div className="max-w-3xl space-y-6 pt-4 pb-10">
      <div>
        <h1 className="text-lg font-semibold">Locations</h1>
        <p className="text-sm text-zinc-500">
          Who looked at which location on the shop list. A device is counted once, by a random id kept in its browser; the admin&apos;s own testing is not counted.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/admin/drone-rental/locations?range=${r.key}`}
            className={`rounded-full border px-3 py-1.5 text-sm ${r.key === range.key ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-zinc-300 dark:border-zinc-700"}`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">No location taps counted in this period yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Devices", value: String(allVisits.size), note: "different devices that tapped or opened a location" },
              { label: "Taps", value: String(total("taps")), note: "on a location in the list or map" },
              { label: "Pages opened", value: String(total("opens")), note: `by ${allOpeners.size} ${allOpeners.size === 1 ? "device" : "devices"}` },
              { label: "Get direction", value: String(total("directions")), note: "clicks" },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="text-xs uppercase tracking-wide text-zinc-500">{c.label}</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-black dark:text-zinc-50">{c.value}</p>
                <p className="text-xs text-zinc-500">{c.note}</p>
              </div>
            ))}
          </div>

          {top && (
            <p className="rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              Most clicked: <span className="font-semibold">{top.name}</span> with {top.taps} {top.taps === 1 ? "tap" : "taps"} and {top.opens} {top.opens === 1 ? "page opened" : "pages opened"} by {top.people}{" "}
              {top.people === 1 ? "device" : "devices"}.
            </p>
          )}

          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2 text-right">Taps</th>
                  <th className="px-3 py-2 text-right">Opened</th>
                  <th className="px-3 py-2 text-right">Directions</th>
                  <th className="px-3 py-2 text-right">Devices</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-900">
                    <td className="px-3 py-2">
                      <p className="font-medium text-black dark:text-zinc-50">
                        {r.name}
                        {r.active && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Open for booking</span>}
                      </p>
                      <div className="mt-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className="h-1.5 rounded-full bg-black dark:bg-white" style={{ width: `${((r.taps + r.opens) / maxScore) * 100}%` }} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.taps}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.opens}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.directions}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{r.people}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-500">
            Taps: a location tapped on the list or the map. Opened: its page opened with Check Rates or Book here, or arrived on directly. Directions: Get direction clicked. Devices: different devices that did
            any of these at that location. Locations are ranked by taps plus pages opened.
          </p>
        </>
      )}
    </div>
  );
}

import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DRONE_FUNNEL_STEPS } from "@/lib/droneFunnel";

export const dynamic = "force-dynamic";

const RANGES = [
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "all", label: "Everything", days: null as number | null },
];

const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "–");

/**
 * Where customers drop off between the home page and paying. Each visit is counted once per step it reached (a random id from the browser tab,
 * nothing that identifies a person). A visit "reached" a step if its furthest step is that one or a later one (so a visit that went straight
 * to the times from a package picked on the home page still counts for the steps it skipped), and it "left" at its furthest step.
 */
export default async function DroneFunnelPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeParam } = await searchParams;
  const range = RANGES.find((r) => r.key === rangeParam) ?? RANGES[1];
  const supabase = await createServerSupabaseClient();

  let query = supabase.from("dr_funnel_events").select("session_id,step").limit(50000);
  if (range.days) query = query.gte("created_at", new Date(new Date().getTime() - range.days * 86_400_000).toISOString());
  const { data: events } = await query;

  const order = new Map<string, number>(DRONE_FUNNEL_STEPS.map((s, i) => [s.key, i]));
  const furthest = new Map<string, number>();
  const hit = new Map<string, Set<string>>();
  for (const e of events ?? []) {
    const i = order.get(e.step);
    if (i === undefined) continue;
    furthest.set(e.session_id, Math.max(furthest.get(e.session_id) ?? -1, i));
    if (!hit.has(e.step)) hit.set(e.step, new Set());
    hit.get(e.step)!.add(e.session_id);
  }
  const visits = furthest.size;
  const reached = DRONE_FUNNEL_STEPS.map((_, i) => [...furthest.values()].filter((f) => f >= i).length);
  const leftHere = DRONE_FUNNEL_STEPS.map((_, i) => [...furthest.values()].filter((f) => f === i).length);
  const last = DRONE_FUNNEL_STEPS.length - 1;
  const biggest = leftHere.slice(0, last).reduce((best, n, i) => (n > leftHere[best] ? i : best), 0);

  return (
    <div className="max-w-3xl space-y-6 pt-4 pb-10">
      <div>
        <h1 className="text-lg font-semibold">Drone Funnel</h1>
        <p className="text-sm text-zinc-500">Where customers drop off between the home page and paying. A device is counted once, by a random id kept in its browser, however many times it comes back; the admin&apos;s own testing is not counted.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={`/admin/drone-rental/funnel?range=${r.key}`}
            className={`rounded-full border px-3 py-1.5 text-sm ${r.key === range.key ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-zinc-300 dark:border-zinc-700"}`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {visits === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">No devices counted in this period yet. Counting starts when the new version of the site is live.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Devices", value: String(visits) },
              { label: "Paid", value: `${reached[last]} (${pct(reached[last], visits)})` },
              { label: "Most leave at", value: `${DRONE_FUNNEL_STEPS[biggest].label.replace(/^Booking page: /, "")}` },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <p className="text-xs uppercase tracking-wide text-zinc-500">{c.label}</p>
                <p className="mt-0.5 text-sm font-semibold text-black dark:text-zinc-50">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2">Step</th>
                  <th className="px-3 py-2 text-right">Reached</th>
                  <th className="px-3 py-2 text-right">Of all devices</th>
                  <th className="px-3 py-2 text-right">Left here</th>
                </tr>
              </thead>
              <tbody>
                {DRONE_FUNNEL_STEPS.map((s, i) => (
                  <tr key={s.key} className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-900">
                    <td className="px-3 py-2">
                      <p className="font-medium text-black dark:text-zinc-50">
                        {i + 1}. {s.label}
                      </p>
                      <div className="mt-1 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className="h-1.5 rounded-full bg-black dark:bg-white" style={{ width: `${visits ? (reached[i] / visits) * 100 : 0}%` }} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{reached[i]}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{pct(reached[i], visits)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${i === biggest && i !== last ? "font-semibold text-red-600 dark:text-red-400" : ""}`}>
                      {i === last ? "–" : `${leftHere[i]} (${pct(leftHere[i], visits)})`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-500">
            Reached: devices that got at least this far (a device is counted once, from the first time it reached each step). Left here: devices whose last step was this one, so the page they dropped off at. The step with the most people leaving is in red. Walk-ins at a
            shop and swaps are not part of this funnel.
          </p>
        </>
      )}
    </div>
  );
}

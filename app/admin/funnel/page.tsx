import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BarChart } from "../sales/charts";

const STAGES: { type: string; label: string; short: string }[] = [
  { type: "LANDING_VIEWED", label: "Scanned QR / viewed landing page", short: "Scanned QR" },
  { type: "WIZARD_OPENED", label: "Opened booking wizard", short: "Opened wizard" },
  { type: "VERIFICATION_STARTED", label: "Entered details, started ID verification", short: "Started verification" },
  { type: "VERIFICATION_VERIFIED", label: "Verified identity", short: "Verified identity" },
  { type: "BOOKING_CREATED", label: "Reached payment", short: "Reached payment" },
  { type: "PAYMENT_CONFIRMED", label: "Paid", short: "Paid" },
];

export default async function FunnelPage() {
  const supabase = await createServerSupabaseClient();

  const [{ data: events }, { data: partners }] = await Promise.all([
    supabase.from("funnel_events").select("event_type,partner_id,created_at"),
    supabase.from("partners").select("id,name"),
  ]);

  const partnerName = new Map((partners ?? []).map((p) => [p.id, p.name]));
  const all = events ?? [];

  const countByType = new Map<string, number>();
  for (const e of all) countByType.set(e.event_type, (countByType.get(e.event_type) ?? 0) + 1);

  const stageRows = STAGES.map((s, i) => {
    const count = countByType.get(s.type) ?? 0;
    const prevCount = i > 0 ? (countByType.get(STAGES[i - 1].type) ?? 0) : null;
    const dropOff = prevCount != null ? Math.max(0, prevCount - count) : null;
    const dropOffPct = prevCount ? Math.round((dropOff! / prevCount) * 100) : dropOff != null ? 0 : null;
    return { ...s, count, dropOff, dropOffPct };
  });

  const countByPartnerAndStage = new Map<string, Map<string, number>>();
  for (const e of all) {
    const key = e.partner_id ?? "unknown";
    if (!countByPartnerAndStage.has(key)) countByPartnerAndStage.set(key, new Map());
    const m = countByPartnerAndStage.get(key)!;
    m.set(e.event_type, (m.get(e.event_type) ?? 0) + 1);
  }
  const lockerRows = [...countByPartnerAndStage.entries()]
    .map(([partnerId, m]) => ({
      name: partnerId === "unknown" ? "Unknown locker" : partnerName.get(partnerId) ?? "Unknown locker",
      counts: STAGES.map((s) => m.get(s.type) ?? 0),
    }))
    .sort((a, b) => b.counts[0] - a.counts[0]);

  return (
    <div className="space-y-8 pt-4 pb-10">
      <div>
        <h1 className="text-lg font-semibold">Funnel</h1>
        <p className="text-sm text-zinc-500">
          {all.length
            ? `${all.length} events recorded, from the first QR scan through to payment.`
            : "No events recorded yet — this starts counting from today onward."}
          {" "}Counts only, no device or customer identifiers.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-500">Overall funnel</h2>
        <BarChart data={stageRows.map((s) => ({ label: s.label, value: s.count }))} formatValue={(n) => String(n)} />
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900">
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Stage</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Count</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Dropped off here</th>
              </tr>
            </thead>
            <tbody>
              {stageRows.map((s) => (
                <tr key={s.type} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2">{s.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.count}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                    {s.dropOff != null ? `${s.dropOff} (${s.dropOffPct}%)` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-400">
          &quot;Dropped off here&quot; is the fall from the stage right above it — the biggest number is roughly
          where people usually give up.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-500">By locker</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900">
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Locker</th>
                {STAGES.map((s) => (
                  <th key={s.type} className="px-2 py-2 text-right font-medium text-zinc-500" title={s.label}>
                    {s.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lockerRows.map((r) => (
                <tr key={r.name} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2 whitespace-nowrap">{r.name}</td>
                  {r.counts.map((c, i) => (
                    <td key={i} className="px-2 py-2 text-right tabular-nums">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
              {!lockerRows.length && (
                <tr>
                  <td colSpan={STAGES.length + 1} className="px-3 py-3 text-center text-zinc-400">
                    No data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

import { createServerSupabaseClient } from "@/lib/supabase/server";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Below this many occurrences in the trailing window, a location's misses
 * read as noise (one unlucky night, one big group) rather than a real
 * capacity gap worth spending money on. Arbitrary but conservative — tune
 * once real data comes in.
 */
const ALERT_THRESHOLD_7D = 3;
const ALERT_THRESHOLD_30D = 8;

type SignalRow = { signal_type: "BOOKING_REJECTED_NO_CAMERA" | "PHOTO_SLOTS_FULL"; partner_id: string | null; created_at: string };

type PartnerCounts = { partnerId: string; name: string; last7: number; last30: number; total: number };

function countByPartner(
  signals: SignalRow[],
  type: SignalRow["signal_type"],
  partnerName: Map<string, string>,
  now: number
): PartnerCounts[] {
  const byPartner = new Map<string, PartnerCounts>();
  for (const s of signals) {
    if (s.signal_type !== type || !s.partner_id) continue;
    const age = now - new Date(s.created_at).getTime();
    const entry = byPartner.get(s.partner_id) ?? {
      partnerId: s.partner_id,
      name: partnerName.get(s.partner_id) ?? "Unknown",
      last7: 0,
      last30: 0,
      total: 0,
    };
    entry.total += 1;
    if (age <= 30 * DAY_MS) entry.last30 += 1;
    if (age <= 7 * DAY_MS) entry.last7 += 1;
    byPartner.set(s.partner_id, entry);
  }
  return [...byPartner.values()].sort((a, b) => b.last30 - a.last30);
}

function isAlerting(c: PartnerCounts): boolean {
  return c.last7 >= ALERT_THRESHOLD_7D || c.last30 >= ALERT_THRESHOLD_30D;
}

export default async function CapacityPage() {
  const supabase = await createServerSupabaseClient();
  const now = Date.now();

  const [{ data: signals }, { data: partners }, { data: assets }] = await Promise.all([
    supabase.from("demand_signals").select("signal_type,partner_id,created_at"),
    supabase.from("partners").select("id,name").order("name", { ascending: true }),
    supabase.from("rental_assets").select("partner_id,status").neq("status", "RETIRED"),
  ]);

  const partnerName = new Map((partners ?? []).map((p) => [p.id, p.name]));
  const all = (signals ?? []) as SignalRow[];

  const cameraRows = countByPartner(all, "BOOKING_REJECTED_NO_CAMERA", partnerName, now);
  const slotRows = countByPartner(all, "PHOTO_SLOTS_FULL", partnerName, now);

  const backupFleetCount = (assets ?? []).filter((a) => !a.partner_id).length;
  const totalFleetCount = (assets ?? []).length;

  const alertingCameraPartners = cameraRows.filter(isAlerting);
  const alertingSlotPartners = slotRows.filter(isAlerting);

  const oldestSignal = all.length
    ? new Date(Math.min(...all.map((s) => new Date(s.created_at).getTime())))
    : null;

  return (
    <div className="space-y-8 pt-4 pb-10">
      <div>
        <h1 className="text-lg font-semibold">Capacity</h1>
        <p className="text-sm text-zinc-500">
          {oldestSignal
            ? `Tracking every time a customer or photo order couldn't be served, since ${oldestSignal.toLocaleDateString()}.`
            : "No missed-demand events recorded yet — this starts counting from today onward."}{" "}
          A partner shows up here only when real demand went unmet, not from guessing at traffic.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500">Cameras</h2>
        <p className="text-xs text-zinc-400">
          Backup fleet (unassigned to any property): {backupFleetCount} of {totalFleetCount} total non-retired cameras.
        </p>

        {alertingCameraPartners.length > 0 && (
          <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              {alertingCameraPartners.length === 1
                ? `${alertingCameraPartners[0].name} is turning customers away for lack of a camera.`
                : `${alertingCameraPartners.length} locations are turning customers away for lack of a camera.`}
            </p>
            <p className="text-amber-800 dark:text-amber-300">
              {alertingCameraPartners.length === 1
                ? "This looks specific to one property — assign it another camera from the backup fleet, or buy one if the backup fleet is already thin."
                : "Spread across several properties like this usually means the whole fleet is undersized, not just one location — consider buying more cameras rather than reshuffling."}
              {" "}If the misses keep happening even after adding a camera there, that's a sign the area has more demand than one property can hold, and a second nearby location might be worth it.
            </p>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900">
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Property</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Last 7 days</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Last 30 days</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">All time</th>
              </tr>
            </thead>
            <tbody>
              {cameraRows.map((r) => (
                <tr key={r.partnerId} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2">
                    {r.name}
                    {isAlerting(r) && <span className="ml-2 text-amber-600 dark:text-amber-400">⚠</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.last7}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.last30}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{r.total}</td>
                </tr>
              ))}
              {!cameraRows.length && (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-center text-zinc-400">
                    No customer has been turned away for lack of a camera yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500">Photo pickup slots</h2>
        <p className="text-xs text-zinc-400">Each property has 50 numbered slots; overflow goes to the wooden box.</p>

        {alertingSlotPartners.length > 0 && (
          <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              {alertingSlotPartners.length === 1
                ? `${alertingSlotPartners[0].name} is regularly running out of pickup slots.`
                : `${alertingSlotPartners.length} locations are regularly running out of pickup slots.`}
            </p>
            <p className="text-amber-800 dark:text-amber-300">
              Photos are still delivered — they just land in the wooden box instead of a numbered slot, which is a
              worse pickup experience. If this keeps happening at the same place, it's worth a bigger box or more
              physical slot space there.
            </p>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900">
                <th className="px-3 py-2 text-left font-medium text-zinc-500">Property</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Last 7 days</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">Last 30 days</th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">All time</th>
              </tr>
            </thead>
            <tbody>
              {slotRows.map((r) => (
                <tr key={r.partnerId} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2">
                    {r.name}
                    {isAlerting(r) && <span className="ml-2 text-amber-600 dark:text-amber-400">⚠</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.last7}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.last30}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{r.total}</td>
                </tr>
              ))}
              {!slotRows.length && (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-center text-zinc-400">
                    No property has run out of pickup slots yet.
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

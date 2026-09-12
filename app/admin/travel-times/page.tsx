import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { DEFAULT_TRAVEL_MINUTES } from "@/lib/locker-engine/routing";
import { updateTravelTimesAction } from "./actions";

export default async function TravelTimesPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: lockers }, { data: travelTimes }] = await Promise.all([
    supabase
      .from("partners")
      .select("id,name,google_maps_url")
      .eq("pickup_method", "LOCKER")
      .eq("status", "ACTIVE")
      .order("name"),
    supabase.from("location_travel_times").select("from_partner_id,to_partner_id,minutes"),
  ]);

  const minutesByPair = new Map((travelTimes ?? []).map((t) => [`${t.from_partner_id}_${t.to_partner_id}`, t.minutes]));

  type Locker = { id: string; name: string; google_maps_url: string | null };
  const pairs: { a: Locker; b: Locker; minutes: number | null }[] = [];
  const list = lockers ?? [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const minutes = minutesByPair.get(`${a.id}_${b.id}`) ?? minutesByPair.get(`${b.id}_${a.id}`) ?? null;
      pairs.push({ a, b, minutes });
    }
  }

  return (
    <div className="space-y-6 pt-4">
      <div>
        <h1 className="text-lg font-semibold">Travel Times</h1>
        <p className="text-sm text-zinc-500">
          How long it takes the worker to drive between each pair of lockers — look it up on Google Maps and enter
          minutes below. Applied the same both ways. Leave a pair blank to fall back to the default of{" "}
          {DEFAULT_TRAVEL_MINUTES} minutes. This drives which order the worker visits stops in when planning a route.
        </p>
      </div>

      {list.length < 2 ? (
        <p className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-400 dark:border-zinc-800">
          Need at least 2 active locker locations before there's a pair to set a travel time for.
        </p>
      ) : (
        <form action={updateTravelTimesAction} className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900">
                  <th className="px-4 py-2 text-left font-medium text-zinc-500">Pair</th>
                  <th className="px-4 py-2 text-right font-medium text-zinc-500">Minutes</th>
                </tr>
              </thead>
              <tbody>
                {pairs.map(({ a, b, minutes }) => (
                  <tr key={`${a.id}_${b.id}`} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-2">
                      <LockerRef locker={a} /> ↔ <LockerRef locker={b} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        name={`pair_${a.id}_${b.id}`}
                        type="number"
                        min={1}
                        placeholder={String(DEFAULT_TRAVEL_MINUTES)}
                        defaultValue={minutes ?? ""}
                        className={`${inputClass} w-24 text-right`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="submit" className={primaryButtonClass}>
            Save Travel Times
          </button>
        </form>
      )}
    </div>
  );
}

function LockerRef({ locker }: { locker: { name: string; google_maps_url: string | null } }) {
  return locker.google_maps_url ? (
    <a href={locker.google_maps_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
      {locker.name}
    </a>
  ) : (
    <span>{locker.name}</span>
  );
}

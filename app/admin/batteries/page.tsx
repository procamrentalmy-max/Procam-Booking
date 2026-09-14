import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { createBatteryAction, updateBatteryAction } from "./actions";

const BATTERY_STATUSES = ["CHARGED", "DEPLOYED", "CHARGING", "MAINTENANCE", "LOST", "RETIRED"] as const;

export default async function BatteriesPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: batteries }, { data: partners }] = await Promise.all([
    supabase.from("batteries").select("*").order("human_id", { ascending: true }),
    supabase.from("partners").select("id,name").order("name", { ascending: true }),
  ]);

  const partnerName = new Map((partners ?? []).map((p) => [p.id, p.name]));

  return (
    <div className="space-y-6 pt-4">
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">New Battery</h2>
        <form action={createBatteryAction} className="grid gap-2 sm:grid-cols-2">
          <select name="partnerId" defaultValue="" className={inputClass}>
            <option value="">Backup fleet (no property)</option>
            {(partners ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="submit" className={primaryButtonClass}>
            Add Battery
          </button>
        </form>
      </section>

      <section className="space-y-2">
        {(batteries ?? []).map((battery) => (
          <form
            key={battery.id}
            action={updateBatteryAction}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <input type="hidden" name="id" value={battery.id} />
            <p className="w-32 font-medium">{battery.human_id}</p>
            <select name="partnerId" defaultValue={battery.partner_id ?? ""} className={inputClass}>
              <option value="">Backup fleet (no property)</option>
              {(partners ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={battery.status} className={inputClass}>
              {BATTERY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="submit" className={primaryButtonClass}>
              Save
            </button>
            <span className="text-xs text-zinc-400">
              {battery.partner_id ? partnerName.get(battery.partner_id) : "—"}
            </span>
            {battery.status === "CHARGING" && battery.cooldown_until && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Cooldown until {new Date(battery.cooldown_until).toLocaleString()}
              </span>
            )}
          </form>
        ))}
      </section>
    </div>
  );
}

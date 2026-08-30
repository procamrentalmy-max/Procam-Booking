import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ALL_CAMERA_STATUSES } from "@/lib/state-machine/camera";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { createCameraAction, updateCameraAction, transitionCameraAction } from "./actions";

export default async function CamerasPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: cameras }, { data: partners }] = await Promise.all([
    supabase.from("cameras").select("*").order("human_id", { ascending: true }),
    supabase.from("partners").select("id,name").order("name", { ascending: true }),
  ]);

  const partnerName = new Map((partners ?? []).map((p) => [p.id, p.name]));

  return (
    <div className="space-y-6 pt-4">
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">New Camera</h2>
        <form action={createCameraAction} className="grid gap-2 sm:grid-cols-4">
          <input name="model" placeholder="Model" required className={inputClass} />
          <input name="serialNumber" placeholder="Serial number" required className={inputClass} />
          <select name="partnerId" defaultValue="" className={inputClass}>
            <option value="">Backup fleet (no property)</option>
            {(partners ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="submit" className={primaryButtonClass}>
            Add Camera
          </button>
        </form>
      </section>

      <section className="space-y-3">
        {(cameras ?? []).map((camera) => (
          <div key={camera.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="font-medium">
              {camera.human_id} — {camera.model}{" "}
              <span className="text-sm text-zinc-500">({camera.serial_number})</span>
            </p>
            <p className="text-sm text-zinc-500">
              {camera.partner_id ? partnerName.get(camera.partner_id) ?? "Unknown property" : "Backup fleet"} —{" "}
              <span className="font-medium">{camera.status}</span>
            </p>

            <div className="mt-3 flex flex-wrap gap-4">
              <form action={transitionCameraAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={camera.id} />
                <select name="toStatus" defaultValue={camera.status} className={inputClass}>
                  {ALL_CAMERA_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button type="submit" className={primaryButtonClass}>
                  Change Status
                </button>
              </form>

              <form action={updateCameraAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={camera.id} />
                <select name="partnerId" defaultValue={camera.partner_id ?? ""} className={inputClass}>
                  <option value="">Backup fleet (no property)</option>
                  {(partners ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input name="notes" placeholder="Notes" defaultValue={camera.notes ?? ""} className={inputClass} />
                <button type="submit" className={primaryButtonClass}>
                  Save
                </button>
              </form>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inputClass } from "@/components/formStyles";
import { ENABLED_DRONE_MODELS, CONTROLLER_PROFILES, DRONE_MODEL_PROFILES, modelProfile } from "@/lib/droneRental/pricingRules";
import { ActionForm } from "@/components/admin/ActionForm";
import {
  createDroneAction,
  createControllerAction,
  deleteControllerAction,
  setDroneStatusAction,
  moveDroneAction,
  updateDroneDetailsAction,
  createBatteriesAction,
  assignBatteryAction,
} from "./actions";

export const dynamic = "force-dynamic";

const DRONE_STATUSES = ["AVAILABLE", "RENTED", "MAINTENANCE", "LOST", "RETIRED"] as const;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The fleet, location by location: each location that has anything shows its drones, batteries and controllers together. A location's own details
 * (name, address, map, hours, opening it to customers) are under Merchants. Adding to the fleet is at the bottom.
 */
export default async function FleetPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: shops }, { data: drones }, { data: batteries }, { data: controllers }] = await Promise.all([
    supabase.from("dr_shops").select("id,human_id,name,active").order("created_at", { ascending: true }),
    supabase.from("dr_drones").select("id,human_id,shop_id,status,serial_number,dji_account,cost_price_myr,model_key").order("human_id"),
    supabase.from("dr_batteries").select("id,human_id,name,shop_id,model_key,status,at_shop_id").order("human_id"),
    supabase.from("dr_controllers").select("id,human_id,shop_id,kind").order("human_id"),
  ]);

  const dronesByShop = new Map<string, NonNullable<typeof drones>>();
  for (const d of drones ?? []) dronesByShop.set(d.shop_id, [...(dronesByShop.get(d.shop_id) ?? []), d]);
  const batteriesByShop = new Map<string, NonNullable<typeof batteries>>();
  for (const b of batteries ?? []) batteriesByShop.set(b.shop_id, [...(batteriesByShop.get(b.shop_id) ?? []), b]);
  const controllersByShop = new Map<string, NonNullable<typeof controllers>>();
  for (const c of controllers ?? []) controllersByShop.set(c.shop_id, [...(controllersByShop.get(c.shop_id) ?? []), c]);

  const withFleet = (shops ?? []).filter((s) => (dronesByShop.get(s.id)?.length ?? 0) + (batteriesByShop.get(s.id)?.length ?? 0) + (controllersByShop.get(s.id)?.length ?? 0) > 0);
  const withoutFleet = (shops ?? []).length - withFleet.length;
  const outNow = (drones ?? []).filter((d) => d.status === "RENTED").length;
  const shopOptions = (shops ?? []).map((s) => (
    <option key={s.id} value={s.id}>
      {s.name}
    </option>
  ));

  return (
    <div className="max-w-4xl space-y-6 pt-4 pb-10">
      <div className="space-y-1">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {plural((drones ?? []).length, "drone", "drones")} · {plural((batteries ?? []).length, "battery", "batteries")} · {plural((controllers ?? []).length, "controller", "controllers")}
          {outNow ? ` · ${outNow} out on a rental now` : ""}
        </p>
        <p className="text-xs text-zinc-500">
          Each location&apos;s own details (name, address, map, hours, opening it to customers) are under{" "}
          <Link href="/admin/merchants" className="underline underline-offset-2">
            Merchants
          </Link>
          . How much each battery has been used is on{" "}
          <Link href="/admin/drone-rental/batteries" className="underline underline-offset-2">
            Drone Batteries
          </Link>
          .
        </p>
      </div>

      {withFleet.map((s) => {
        const sd = dronesByShop.get(s.id) ?? [];
        const sb = batteriesByShop.get(s.id) ?? [];
        const sc = controllersByShop.get(s.id) ?? [];
        return (
          <details key={s.id} open className="rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-4">
              <span className="font-semibold text-black dark:text-zinc-50">{s.name}</span>
              <span className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                {plural(sd.length, "drone", "drones")} · {plural(sb.length, "battery", "batteries")} · {plural(sc.length, "controller", "controllers")}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.active ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}
                >
                  {s.active ? "Open to customers" : "Not open yet"}
                </span>
              </span>
            </summary>

            <div className="space-y-5 border-t border-zinc-200 p-4 dark:border-zinc-800">
              <div className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Drones</h3>
                {sd.map((d) => (
                  <div key={d.id} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium">
                          {d.human_id} · {modelProfile(d.model_key).shortName}
                        </p>
                        <p className="text-sm text-zinc-500">RM{d.cost_price_myr} cost</p>
                        <p className="text-sm text-zinc-500">
                          Serial: {d.serial_number || "not entered"} · DJI account: {d.dji_account || "not entered"}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <ActionForm action={updateDroneDetailsAction} submitLabel="Save details" savedText="Saved." compact className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={d.id} />
                          <input name="serialNumber" defaultValue={d.serial_number ?? ""} maxLength={60} placeholder="Serial number" aria-label={`Serial number of ${d.human_id}`} className={`w-36 ${inputClass}`} />
                          <input name="djiAccount" defaultValue={d.dji_account ?? ""} maxLength={60} placeholder="DJI account, e.g. procam1" aria-label={`DJI account of ${d.human_id}`} className={`w-44 ${inputClass}`} />
                        </ActionForm>
                        <ActionForm action={moveDroneAction} submitLabel="Move" savedText="Moved." compact className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={d.id} />
                          <select name="shopId" defaultValue={d.shop_id} aria-label={`Location for ${d.human_id}`} className={inputClass}>
                            {shopOptions}
                          </select>
                        </ActionForm>
                        <ActionForm action={setDroneStatusAction} submitLabel="Save status" compact className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={d.id} />
                          <select name="status" defaultValue={d.status} aria-label={`Status of ${d.human_id}`} className={inputClass}>
                            {DRONE_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </ActionForm>
                      </div>
                    </div>
                  </div>
                ))}
                {sd.length === 0 && <p className="text-sm text-zinc-400">No drones here.</p>}
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Batteries</h3>
                {sb.map((b) => (
                  <ActionForm key={b.id} action={assignBatteryAction} submitLabel="Save" compact className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={b.id} />
                    <input name="name" defaultValue={b.name ?? b.human_id} maxLength={30} aria-label={`Name for battery ${b.human_id}`} className={`w-28 ${inputClass}`} />
                    <select name="shopId" defaultValue={b.shop_id} aria-label={`Location for battery ${b.name ?? b.human_id}`} className={inputClass}>
                      {shopOptions}
                    </select>
                    <span className="text-xs text-zinc-500">
                      {modelProfile(b.model_key).shortName}
                      {b.status !== "AT_SHOP" ? ` · ${b.status === "WITH_CUSTOMER" ? "out on a rental" : b.status}` : ""}
                    </span>
                  </ActionForm>
                ))}
                {sb.length === 0 && <p className="text-sm text-zinc-400">No batteries here.</p>}
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Controllers</h3>
                {sc.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <p className="text-sm">
                      <span className="font-medium">{c.human_id}</span> · {CONTROLLER_PROFILES[c.kind].name}
                    </p>
                    <ActionForm action={deleteControllerAction} submitLabel="Remove" savedText="Removed." compact className="flex items-center gap-2">
                      <input type="hidden" name="id" value={c.id} />
                    </ActionForm>
                  </div>
                ))}
                {sc.length === 0 && <p className="text-sm text-zinc-400">No controllers here: customers can only fly from their own phone.</p>}
              </div>
            </div>
          </details>
        );
      })}

      {withFleet.length === 0 && <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-400 dark:border-zinc-700">No drones, batteries or controllers yet. Add some below.</p>}
      {withoutFleet > 0 && <p className="text-xs text-zinc-500">{plural(withoutFleet, "other location has", "other locations have")} no drones, batteries or controllers yet. Add to any of them below.</p>}

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Add to the fleet</h2>

        <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm font-semibold">Add a drone</summary>
          <ActionForm action={createDroneAction} submitLabel="Add drone" savedText="Drone added." resetOnSuccess className="mt-3 grid gap-2 sm:grid-cols-2">
            <select name="model" required defaultValue="NEO2" className={inputClass}>
              {ENABLED_DRONE_MODELS.map((m) => (
                <option key={m} value={m}>
                  {DRONE_MODEL_PROFILES[m].shortName}
                </option>
              ))}
            </select>
            <select name="shopId" required defaultValue="" className={inputClass}>
              <option value="">Select location…</option>
              {shopOptions}
            </select>
            <input name="serialNumber" placeholder="Serial number (optional)" className={inputClass} />
            <input name="djiAccount" placeholder="DJI account, e.g. procam1 (optional)" className={inputClass} />
            <input name="costPriceMyr" type="number" step="0.01" min="0" placeholder="What you paid for it (RM)" required className={inputClass} />
          </ActionForm>
        </details>

        <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm font-semibold">Add batteries</summary>
          <p className="mt-2 text-xs text-zinc-500">
            Batteries belong to a location, not to a drone. At every handover the merchant picks which of the location&apos;s charged batteries go out (any battery of the right make fits any drone of that make). Each one is
            numbered B1, B2… across all locations and every sticker number must be different.
          </p>
          <ActionForm action={createBatteriesAction} submitLabel="Add batteries" savedText="Batteries added." resetOnSuccess className="mt-3 grid gap-2 sm:grid-cols-3">
            <select name="model" required defaultValue="NEO2" className={inputClass}>
              {ENABLED_DRONE_MODELS.map((m) => (
                <option key={m} value={m}>
                  {DRONE_MODEL_PROFILES[m].shortName}
                </option>
              ))}
            </select>
            <select name="shopId" required defaultValue="" className={inputClass}>
              <option value="">Select location…</option>
              {shopOptions}
            </select>
            <input name="count" type="number" min="1" max="50" defaultValue="1" required aria-label="How many" className={inputClass} />
          </ActionForm>
        </details>

        <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm font-semibold">Add a controller</summary>
          <p className="mt-2 text-xs text-zinc-500">What a customer can add to a drone: the RC-N3 controller or the Goggles N3 + Motion 3 set. A location only offers the kinds it has here, and each is on one booking at a time.</p>
          <ActionForm action={createControllerAction} submitLabel="Add controller" savedText="Controller added." resetOnSuccess className="mt-3 grid gap-2 sm:grid-cols-2">
            <select name="kind" required defaultValue="RC_N3" className={inputClass}>
              <option value="RC_N3">{CONTROLLER_PROFILES.RC_N3.name}</option>
              <option value="GOGGLES_N3">{CONTROLLER_PROFILES.GOGGLES_N3.name}</option>
            </select>
            <select name="shopId" required defaultValue="" className={inputClass}>
              <option value="">Select location…</option>
              {shopOptions}
            </select>
          </ActionForm>
        </details>
      </section>
    </div>
  );
}

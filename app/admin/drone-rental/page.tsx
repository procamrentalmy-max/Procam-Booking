import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import {
  createShopAction,
  setShopActiveAction,
  createDroneAction,
  setDroneStatusAction,
  assignMerchantShopsAction,
} from "./actions";

const DRONE_STATUSES = ["AVAILABLE", "RENTED", "MAINTENANCE", "LOST", "RETIRED"] as const;

export default async function DroneRentalAdminPage() {
  const supabase = await createServerSupabaseClient();

  const [{ data: shops }, { data: drones }, { data: batteries }, { data: merchants }, { data: assignments }] = await Promise.all([
    supabase.from("dr_shops").select("id,human_id,name,address,lat,lng,active").order("created_at", { ascending: true }),
    supabase.from("dr_drones").select("id,human_id,shop_id,status,serial_number,cost_price_myr").order("human_id"),
    supabase.from("dr_batteries").select("drone_id,status"),
    supabase.from("staff_users").select("id,name,active").eq("role", "DRONE_MERCHANT"),
    supabase.from("dr_merchant_shops").select("staff_user_id,shop_id"),
  ]);

  const batteryCountByDrone = new Map<string, { total: number; atShop: number }>();
  for (const b of batteries ?? []) {
    const entry = batteryCountByDrone.get(b.drone_id) ?? { total: 0, atShop: 0 };
    entry.total += 1;
    if (b.status === "AT_SHOP") entry.atShop += 1;
    batteryCountByDrone.set(b.drone_id, entry);
  }
  const shopNameById = new Map((shops ?? []).map((s) => [s.id, s.name]));
  const assignedShopIdsByMerchant = new Map<string, Set<string>>();
  for (const a of assignments ?? []) {
    if (!assignedShopIdsByMerchant.has(a.staff_user_id)) assignedShopIdsByMerchant.set(a.staff_user_id, new Set());
    assignedShopIdsByMerchant.get(a.staff_user_id)!.add(a.shop_id);
  }

  return (
    <div className="space-y-6 pt-4">
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">New Shop</h2>
        <form action={createShopAction} className="grid gap-2 sm:grid-cols-2">
          <input name="name" placeholder="Shop name" required className={inputClass} />
          <input name="address" placeholder="Address" required className={inputClass} />
          <input name="lat" type="number" step="0.000001" placeholder="Latitude" required className={inputClass} />
          <input name="lng" type="number" step="0.000001" placeholder="Longitude" required className={inputClass} />
          <input name="googleMapsUrl" type="url" placeholder="Google Maps link (optional)" className={`${inputClass} sm:col-span-2`} />
          <button type="submit" className={`${primaryButtonClass} sm:col-span-2`}>
            Create Shop
          </button>
        </form>
        <p className="mt-2 text-xs text-zinc-500">
          Get exact coordinates by right-clicking the spot on Google Maps and copying the lat/lng shown.
        </p>
      </section>

      <section className="space-y-3">
        {(shops ?? []).map((s) => (
          <div key={s.id} className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
            <div>
              <p className="font-medium">
                {s.human_id} — {s.name}
              </p>
              <p className="text-sm text-zinc-500">{s.address}</p>
              <p className="text-xs text-zinc-400">
                {s.lat}, {s.lng}
              </p>
            </div>
            <form action={setShopActiveAction} className="flex items-center gap-2">
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="active" value={(!s.active).toString()} />
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.active ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                {s.active ? "Active" : "Inactive"}
              </span>
              <button type="submit" className={primaryButtonClass}>
                {s.active ? "Deactivate" : "Activate"}
              </button>
            </form>
          </div>
        ))}
        {(shops ?? []).length === 0 && <p className="text-sm text-zinc-400">No shops yet — add one above.</p>}
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">New Drone</h2>
        <form action={createDroneAction} className="grid gap-2 sm:grid-cols-2">
          <select name="shopId" required className={inputClass}>
            <option value="">Select shop…</option>
            {(shops ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input name="serialNumber" placeholder="Serial number (optional)" className={inputClass} />
          <input name="costPriceMyr" type="number" step="0.01" min="0" defaultValue="1100" required className={inputClass} />
          <button type="submit" className={`${primaryButtonClass} sm:col-span-2`}>
            Create Drone (adds 3 batteries automatically)
          </button>
        </form>
      </section>

      <section className="space-y-3">
        {(drones ?? []).map((d) => {
          const batteryCount = batteryCountByDrone.get(d.id) ?? { total: 0, atShop: 0 };
          return (
            <div key={d.id} className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
              <div>
                <p className="font-medium">
                  {d.human_id} — {shopNameById.get(d.shop_id) ?? "—"}
                </p>
                <p className="text-sm text-zinc-500">RM{d.cost_price_myr} cost · {batteryCount.atShop}/{batteryCount.total} batteries at shop</p>
              </div>
              <form action={setDroneStatusAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={d.id} />
                <select name="status" defaultValue={d.status} className={inputClass}>
                  {DRONE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button type="submit" className={primaryButtonClass}>
                  Save
                </button>
              </form>
            </div>
          );
        })}
        {(drones ?? []).length === 0 && <p className="text-sm text-zinc-400">No drones yet — add one above.</p>}
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">Merchant Shop Assignments</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Create a Drone Merchant account first from <a href="/admin/staff" className="underline underline-offset-2">Staff</a>.
        </p>
        {(merchants ?? []).map((m) => {
          const assignedIds = assignedShopIdsByMerchant.get(m.id) ?? new Set<string>();
          return (
            <form key={m.id} action={assignMerchantShopsAction} className="mb-3 space-y-2 border-t border-zinc-100 pt-3 first:border-t-0 first:pt-0 dark:border-zinc-900">
              <input type="hidden" name="staffUserId" value={m.id} />
              <p className="text-sm font-medium">{m.name}</p>
              <div className="flex flex-wrap gap-3">
                {(shops ?? []).map((s) => (
                  <label key={s.id} className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name="shopIds" value={s.id} defaultChecked={assignedIds.has(s.id)} />
                    {s.name}
                  </label>
                ))}
              </div>
              <button type="submit" className={primaryButtonClass}>
                Save
              </button>
            </form>
          );
        })}
        {(merchants ?? []).length === 0 && <p className="text-sm text-zinc-400">No merchant accounts yet.</p>}
      </section>
    </div>
  );
}

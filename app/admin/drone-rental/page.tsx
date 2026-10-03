import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import { formatMyr } from "@/lib/droneRental/pricingRules";
import {
  createShopAction,
  setShopActiveAction,
  createDroneAction,
  setDroneStatusAction,
  assignMerchantShopsAction,
} from "./actions";

const DRONE_STATUSES = ["AVAILABLE", "RENTED", "MAINTENANCE", "LOST", "RETIRED"] as const;

const STATUS_BADGE: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  CONFIRMED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  ACTIVE: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  CANCELLED: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  EXPIRED: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const PAID_STATUSES = ["CONFIRMED", "ACTIVE", "COMPLETED"];

/** 00:00 on the 1st of the current month in Malaysia time (UTC+8), as an ISO instant. */
function startOfMalaysiaMonthIso(now: Date): string {
  const shifted = new Date(now.getTime() + 8 * 60 * 60_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - 8 * 60 * 60_000).toISOString();
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-100 p-3 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-black dark:text-zinc-50">{value}</p>
    </div>
  );
}

export default async function DroneRentalAdminPage() {
  const supabase = await createServerSupabaseClient();
  const monthStart = startOfMalaysiaMonthIso(new Date());

  const [{ data: shops }, { data: drones }, { data: batteries }, { data: merchants }, { data: assignments }, { data: recent }, { data: monthBookings }] =
    await Promise.all([
      supabase.from("dr_shops").select("id,human_id,name,address,lat,lng,active").order("created_at", { ascending: true }),
      supabase.from("dr_drones").select("id,human_id,shop_id,status,serial_number,cost_price_myr").order("human_id"),
      supabase.from("dr_batteries").select("drone_id,status"),
      supabase.from("staff_users").select("id,name,active").eq("role", "DRONE_MERCHANT"),
      supabase.from("dr_merchant_shops").select("staff_user_id,shop_id"),
      supabase
        .from("dr_bookings")
        .select("id,human_id,status,source,start_time,end_time,rental_fee_myr,drone_charge_myr,controller_charge_myr,customer_id,shop_id,drone_id")
        .order("created_at", { ascending: false })
        .limit(15),
      supabase.from("dr_bookings").select("status,rental_fee_myr").gte("created_at", monthStart),
    ]);

  const customerIds = [...new Set((recent ?? []).map((b) => b.customer_id))];
  const { data: customers } = customerIds.length
    ? await supabase.from("customers").select("id,name,phone").in("id", customerIds)
    : { data: [] as { id: string; name: string; phone: string }[] };
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

  const batteryCountByDrone = new Map<string, { total: number; atShop: number }>();
  for (const b of batteries ?? []) {
    const entry = batteryCountByDrone.get(b.drone_id) ?? { total: 0, atShop: 0 };
    entry.total += 1;
    if (b.status === "AT_SHOP") entry.atShop += 1;
    batteryCountByDrone.set(b.drone_id, entry);
  }
  const shopNameById = new Map((shops ?? []).map((s) => [s.id, s.name]));
  const droneHumanById = new Map((drones ?? []).map((d) => [d.id, d.human_id]));
  const assignedShopIdsByMerchant = new Map<string, Set<string>>();
  for (const a of assignments ?? []) {
    if (!assignedShopIdsByMerchant.has(a.staff_user_id)) assignedShopIdsByMerchant.set(a.staff_user_id, new Set());
    assignedShopIdsByMerchant.get(a.staff_user_id)!.add(a.shop_id);
  }

  const paidThisMonth = (monthBookings ?? []).filter((b) => PAID_STATUSES.includes(b.status));
  const feesThisMonth = paidThisMonth.reduce((sum, b) => sum + Number(b.rental_fee_myr), 0);
  const outNow = (drones ?? []).filter((d) => d.status === "RENTED").length;
  const activeDrones = (drones ?? []).filter((d) => d.status !== "RETIRED" && d.status !== "LOST").length;

  return (
    <div className="space-y-8 pt-4">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Paid bookings this month" value={String(paidThisMonth.length)} />
        <Stat label="Rental fees this month" value={formatMyr(feesThisMonth)} />
        <Stat label="Drones out now" value={`${outNow} of ${activeDrones}`} />
        <Stat label="Active shops" value={String((shops ?? []).filter((s) => s.active).length)} />
      </section>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Recent bookings</h2>
        <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
          {(recent ?? []).map((b) => {
            const customer = customerById.get(b.customer_id);
            const kept = Number(b.drone_charge_myr) + Number(b.controller_charge_myr);
            return (
              <div key={b.id} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">
                    {customer?.name ?? "—"} <span className="font-normal text-zinc-400">· {b.human_id}</span>
                  </p>
                  <p className="text-xs text-zinc-500">
                    {shopNameById.get(b.shop_id) ?? "—"} · {droneHumanById.get(b.drone_id) ?? "—"} · {formatMalaysiaTime(new Date(b.start_time), "en")} to{" "}
                    {formatMalaysiaTime(new Date(b.end_time), "en")}
                    {b.source === "MERCHANT_INSTANT" ? " · walk-in" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {kept > 0 && <span className="text-xs text-red-600">Kept {formatMyr(kept)}</span>}
                  <span className="text-sm font-medium">{formatMyr(Number(b.rental_fee_myr))}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[b.status] ?? ""}`}>{b.status.replace("_", " ")}</span>
                </div>
              </div>
            );
          })}
          {(recent ?? []).length === 0 && <p className="p-4 text-sm text-zinc-400">No bookings yet.</p>}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Shops</h2>
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
        {(shops ?? []).length === 0 && <p className="text-sm text-zinc-400">No shops yet. Add one below.</p>}

        <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm font-semibold">Add a shop</summary>
          <form action={createShopAction} className="mt-3 grid gap-2 sm:grid-cols-2">
            <input name="name" placeholder="Shop name" required className={inputClass} />
            <input name="address" placeholder="Address" required className={inputClass} />
            <input name="lat" type="number" step="0.000001" placeholder="Latitude" required className={inputClass} />
            <input name="lng" type="number" step="0.000001" placeholder="Longitude" required className={inputClass} />
            <input name="googleMapsUrl" type="url" placeholder="Google Maps link (optional)" className={`${inputClass} sm:col-span-2`} />
            <button type="submit" className={`${primaryButtonClass} sm:col-span-2`}>
              Create Shop
            </button>
          </form>
          <p className="mt-2 text-xs text-zinc-500">Get exact coordinates by right-clicking the spot on Google Maps and copying the lat/lng shown.</p>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Drones</h2>
        {(drones ?? []).map((d) => {
          const batteryCount = batteryCountByDrone.get(d.id) ?? { total: 0, atShop: 0 };
          return (
            <div key={d.id} className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
              <div>
                <p className="font-medium">
                  {d.human_id} — {shopNameById.get(d.shop_id) ?? "—"}
                </p>
                <p className="text-sm text-zinc-500">
                  RM{d.cost_price_myr} cost · {batteryCount.atShop}/{batteryCount.total} batteries at shop
                </p>
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
        {(drones ?? []).length === 0 && <p className="text-sm text-zinc-400">No drones yet. Add one below.</p>}

        <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm font-semibold">Add a drone</summary>
          <form action={createDroneAction} className="mt-3 grid gap-2 sm:grid-cols-2">
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
        </details>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-1 text-sm font-semibold">Merchant shop assignments</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Create a Drone Merchant account first from{" "}
          <a href="/admin/staff" className="underline underline-offset-2">
            Staff
          </a>
          .
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

import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { formatMalaysiaTime } from "@/lib/i18n/locale";
import { ENABLED_DRONE_MODELS, CONTROLLER_PROFILES, DRONE_MODEL_PROFILES, formatMyr, modelProfile } from "@/lib/droneRental/pricingRules";
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
  const { count: damagePending } = await supabase.from("dr_bookings").select("id", { count: "exact", head: true }).eq("damage_review", "PENDING");

  const [{ data: shops }, { data: drones }, { data: batteries }, { data: controllers }, { data: merchants }, { data: assignments }, { data: recent }, { data: monthBookings }] =
    await Promise.all([
      supabase.from("dr_shops").select("id,human_id,name,address,lat,lng,active,hours").order("created_at", { ascending: true }),
      supabase.from("dr_drones").select("id,human_id,shop_id,status,serial_number,dji_account,cost_price_myr,model_key").order("human_id"),
      supabase.from("dr_batteries").select("id,human_id,name,shop_id,model_key,status,at_shop_id").order("human_id"),
      supabase.from("dr_controllers").select("id,human_id,shop_id,kind").order("human_id"),
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

  const batteriesByShop = new Map<string, NonNullable<typeof batteries>>();
  for (const b of batteries ?? []) batteriesByShop.set(b.shop_id, [...(batteriesByShop.get(b.shop_id) ?? []), b]);
  const dronesByShop = new Map<string, number>();
  for (const d of drones ?? []) dronesByShop.set(d.shop_id, (dronesByShop.get(d.shop_id) ?? 0) + 1);
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
      <Link
        href="/admin/drone-rental/damage"
        className="flex min-h-12 items-center justify-between rounded-xl border border-zinc-200 p-4 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
      >
        <span>
          <span className="block font-medium text-black dark:text-zinc-50">Damage review{damagePending ? ` · ${damagePending} waiting` : ""}</span>
          <span className="block text-sm text-zinc-500">Tonight: type the amount to keep for each damaged item and capture it from the deposit</span>
        </span>
        <span aria-hidden className="text-zinc-400">→</span>
      </Link>

      <Link
        href="/admin/drone-rental/sales"
        className="flex min-h-12 items-center justify-between rounded-xl border border-zinc-200 p-4 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
      >
        <span>
          <span className="block font-medium text-black dark:text-zinc-50">Sales analysis</span>
          <span className="block text-sm text-zinc-500">Revenue by month, shop, drone and rental length</span>
        </span>
        <span aria-hidden className="text-zinc-400">→</span>
      </Link>

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
        <p className="text-xs text-zinc-500">
          A shop is created together with its Drone Merchant account, and its name, address, map position and opening hours are edited there: Admin &gt; Staff, then Edit info under the merchant.{" "}
          <a href="/admin/staff" className="underline underline-offset-2">
            Open Staff
          </a>
          . Below, give each shop its drones, batteries and controllers.
        </p>
        {(shops ?? []).map((s) => {
          const merchantNames = (merchants ?? []).filter((m) => (assignedShopIdsByMerchant.get(m.id) ?? new Set<string>()).has(s.id)).map((m) => m.name);
          const shelf = batteriesByShop.get(s.id) ?? [];
          return (
            <div key={s.id} className="flex flex-col gap-1 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {s.human_id} — {s.name}
                </p>
                <p className="text-sm text-zinc-500">{s.address}</p>
                <p className="text-xs text-zinc-400">{merchantNames.length ? `Merchant: ${merchantNames.join(", ")}` : "No merchant account yet"}</p>
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-500">
                <span>
                  {dronesByShop.get(s.id) ?? 0} drone(s) · {shelf.length} batteries
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.active ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                  {s.active ? "Open to customers" : "Not open yet"}
                </span>
              </div>
            </div>
          );
        })}
        {(shops ?? []).length === 0 && <p className="text-sm text-zinc-400">No shops yet. Create a Drone Merchant account in Staff and its shop is made with it.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Drones</h2>
        <p className="text-xs text-zinc-500">Each drone is at one shop. Move it to another shop from its card.</p>
        {(drones ?? []).map((d) => (
          <div key={d.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium">
                  {d.human_id} · {modelProfile(d.model_key).shortName} — {shopNameById.get(d.shop_id) ?? "—"}
                </p>
                <p className="text-sm text-zinc-500">RM{d.cost_price_myr} cost</p>
                <p className="text-sm text-zinc-500">
                  Serial: {d.serial_number || "not entered"} · DJI account: {d.dji_account || "not entered"}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <ActionForm action={moveDroneAction} submitLabel="Move" savedText="Moved." compact className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={d.id} />
                  <select name="shopId" defaultValue={d.shop_id} aria-label={`Shop for ${d.human_id}`} className={inputClass}>
                    {(shops ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
                  </select>
                </ActionForm>
                <ActionForm action={updateDroneDetailsAction} submitLabel="Save details" savedText="Saved." compact className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={d.id} />
                  <input name="serialNumber" defaultValue={d.serial_number ?? ""} maxLength={60} placeholder="Serial number" aria-label={`Serial number of ${d.human_id}`} className={`w-36 ${inputClass}`} />
                  <input name="djiAccount" defaultValue={d.dji_account ?? ""} maxLength={60} placeholder="DJI account, e.g. procam1" aria-label={`DJI account of ${d.human_id}`} className={`w-44 ${inputClass}`} />
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
        {(drones ?? []).length === 0 && <p className="text-sm text-zinc-400">No drones yet. Add one below.</p>}

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
              <option value="">Select shop…</option>
              {(shops ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input name="serialNumber" placeholder="Serial number (optional)" className={inputClass} />
            <input name="djiAccount" placeholder="DJI account, e.g. procam1 (optional)" className={inputClass} />
            <input name="costPriceMyr" type="number" step="0.01" min="0" placeholder="What you paid for it (RM)" required className={inputClass} />
          </ActionForm>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Batteries</h2>
        <p className="text-xs text-zinc-500">
          Batteries belong to a shop, not to a drone. At every handover the merchant picks which of the shop&apos;s charged batteries go out (any battery of the right make fits any drone of that make). The name is what is on the sticker, and every
          battery needs its own number.
        </p>
        {(shops ?? []).map((s) => {
          const shelf = batteriesByShop.get(s.id) ?? [];
          return (
            <div key={s.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="mb-2 text-sm font-medium">
                {s.name} <span className="font-normal text-zinc-500">· {shelf.length} batter{shelf.length === 1 ? "y" : "ies"}</span>
              </p>
              <div className="space-y-2">
                {shelf.map((b) => (
                  <ActionForm key={b.id} action={assignBatteryAction} submitLabel="Save" compact className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={b.id} />
                    <input name="name" defaultValue={b.name ?? b.human_id} maxLength={30} aria-label={`Name for battery ${b.human_id}`} className={`w-28 ${inputClass}`} />
                    <select name="shopId" defaultValue={b.shop_id} aria-label={`Shop for battery ${b.name ?? b.human_id}`} className={inputClass}>
                      {(shops ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
                    </select>
                    <span className="text-xs text-zinc-500">
                      {modelProfile(b.model_key).shortName}
                      {b.status !== "AT_SHOP" ? ` · ${b.status === "WITH_CUSTOMER" ? "out on a rental" : b.status}` : ""}
                    </span>
                  </ActionForm>
                ))}
                {shelf.length === 0 && <p className="text-sm text-zinc-400">No batteries at this shop yet.</p>}
              </div>
            </div>
          );
        })}
        <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm font-semibold">Add batteries</summary>
          <ActionForm action={createBatteriesAction} submitLabel="Add batteries" savedText="Batteries added." resetOnSuccess className="mt-3 grid gap-2 sm:grid-cols-3">
            <select name="model" required defaultValue="NEO2" className={inputClass}>
              {ENABLED_DRONE_MODELS.map((m) => (
                <option key={m} value={m}>
                  {DRONE_MODEL_PROFILES[m].shortName}
                </option>
              ))}
            </select>
            <select name="shopId" required defaultValue="" className={inputClass}>
              <option value="">Select shop…</option>
              {(shops ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input name="count" type="number" min="1" max="30" defaultValue="1" required aria-label="How many batteries" className={inputClass} />
          </ActionForm>
          <p className="mt-2 text-xs text-zinc-500">They get the next sticker numbers (B8, B9, ...): the numbers are shared by every shop, so none repeats.</p>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Controllers</h2>
        <p className="text-xs text-zinc-500">
          What a customer can add to a drone: the RC-N3 controller or the Goggles N3 + Motion 3 set. A shop only offers the kinds it has here, and each is on one booking at a time.
        </p>
        {(controllers ?? []).map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-sm">
              <span className="font-medium">{c.human_id}</span> · {CONTROLLER_PROFILES[c.kind].name} — {shopNameById.get(c.shop_id) ?? "—"}
            </p>
            <ActionForm action={deleteControllerAction} submitLabel="Remove" savedText="Removed." compact className="flex items-center gap-2">
              <input type="hidden" name="id" value={c.id} />
            </ActionForm>
          </div>
        ))}
        {(controllers ?? []).length === 0 && <p className="text-sm text-zinc-400">No controllers yet: customers can only rent drones to fly from their own phone.</p>}
        <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm font-semibold">Add a controller</summary>
          <ActionForm action={createControllerAction} submitLabel="Add controller" savedText="Controller added." resetOnSuccess className="mt-3 grid gap-2 sm:grid-cols-2">
            <select name="kind" required defaultValue="RC_N3" className={inputClass}>
              <option value="RC_N3">{CONTROLLER_PROFILES.RC_N3.name}</option>
              <option value="GOGGLES_N3">{CONTROLLER_PROFILES.GOGGLES_N3.name}</option>
            </select>
            <select name="shopId" required defaultValue="" className={inputClass}>
              <option value="">Select shop…</option>
              {(shops ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </ActionForm>
        </details>
      </section>
    </div>
  );
}

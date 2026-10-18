import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { primaryButtonClass } from "@/components/formStyles";
import { emailToUsername } from "@/lib/auth/username";
import { parseShopHours } from "@/lib/droneRental/hours";
import { shopInfoComplete } from "@/lib/droneRental/shopInfo";
import { openGaps } from "@/lib/droneRental/openReadiness";
import { setStaffActiveAction } from "../staff/actions";
import { CreateStaffForm } from "../staff/CreateStaffForm";
import { EditLoginForm } from "../staff/EditLoginForm";
import { EditShopInfoForm, type ShopInfo } from "../staff/EditShopInfoForm";
import { MerchantFilter } from "./MerchantFilter";

export const dynamic = "force-dynamic";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Every merchant, which is every location: a merchant account is created together with its location (address and map position), and everything about
 * both lives here: the location's name, address, map and opening hours, whether it is open to customers, the login, and how much fleet it has.
 */
export default async function MerchantsPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: staff }, { data: shops }, { data: links }, { data: drones }, { data: batteries }, { data: controllers }] = await Promise.all([
    supabase.from("staff_users").select("id,auth_user_id,name,active").eq("role", "DRONE_MERCHANT").order("created_at", { ascending: true }),
    supabase.from("dr_shops").select("id,name,address,lat,lng,google_maps_url,active,hours"),
    supabase.from("dr_merchant_shops").select("staff_user_id,shop_id"),
    supabase.from("dr_drones").select("shop_id,status"),
    supabase.from("dr_batteries").select("shop_id"),
    supabase.from("dr_controllers").select("shop_id"),
  ]);
  const { data: usersPage } = await createServiceRoleClient().auth.admin.listUsers({ perPage: 1000 });
  const emailByAuthId = new Map(usersPage?.users.map((u) => [u.id, u.email]));

  const shopById = new Map((shops ?? []).map((s) => [s.id, s]));
  const shopIdByStaff = new Map((links ?? []).map((l) => [l.staff_user_id, l.shop_id]));
  const count = (rows: { shop_id: string }[] | null, shopId: string) => (rows ?? []).filter((r) => r.shop_id === shopId).length;
  const workingDrones = (shopId: string) => (drones ?? []).filter((d) => d.shop_id === shopId && d.status !== "RETIRED" && d.status !== "LOST").length;

  const rows = (staff ?? []).map((s) => {
    const shop = shopIdByStaff.has(s.id) ? shopById.get(shopIdByStaff.get(s.id)!) : undefined;
    const email = emailByAuthId.get(s.auth_user_id) ?? "";
    const username = emailToUsername(email);
    const info: ShopInfo | null = shop
      ? {
          id: shop.id,
          name: shop.name,
          address: shop.address,
          lat: shop.lat,
          lng: shop.lng,
          googleMapsUrl: shop.google_maps_url,
          active: shop.active,
          hours: parseShopHours(shop.hours),
          needsDetails: !shopInfoComplete(shop),
          openGaps: openGaps({ address: shop.address, lat: shop.lat, lng: shop.lng, hours: parseShopHours(shop.hours), workingDrones: workingDrones(shop.id), batteries: count(batteries, shop.id) }),
        }
      : null;
    return { s, info, username, email, drones: shop ? count(drones, shop.id) : 0, batteries: shop ? count(batteries, shop.id) : 0, controllers: shop ? count(controllers, shop.id) : 0 };
  });
  const openCount = rows.filter((r) => r.info?.active).length;

  return (
    <div className="max-w-4xl space-y-6 pt-4 pb-10">
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-1 text-sm font-semibold">Add a merchant</h2>
        <p className="mb-3 text-xs text-zinc-500">
          A merchant account is its location: put in the name customers will see, the address, and click the position on the map. It starts closed to customers. Give it drones and batteries on the Fleet page,
          then open it here. Share the username and password with the merchant directly.
        </p>
        <CreateStaffForm mode="merchant" />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">All merchants</h2>
          <p className="text-xs text-zinc-500">
            {rows.length} in total · {openCount} open to customers
          </p>
        </div>

        <MerchantFilter>
          {rows.map(({ s, info, username, email, drones: dn, batteries: bn, controllers: cn }) => (
            <div key={s.id} data-merchant={`${info?.name ?? s.name} ${username ?? email}`.toLowerCase()} className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-black dark:text-zinc-50">{info?.name ?? s.name}</p>
                  <p className="text-sm text-zinc-500">Username: {username ?? email}</p>
                  <p className="text-xs text-zinc-500">
                    {plural(dn, "drone", "drones")} · {plural(bn, "battery", "batteries")} · {plural(cn, "controller", "controllers")}
                  </p>
                  {info && !info.active && info.openGaps.length > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">Needs before it can open: {info.openGaps.join("; ")}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${info?.active ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}
                  >
                    {info?.active ? "Open to customers" : "Not open yet"}
                  </span>
                  {!s.active && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900 dark:text-red-200">Login deactivated</span>}
                  <form action={setStaffActiveAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="active" value={(!s.active).toString()} />
                    <button type="submit" className={primaryButtonClass}>
                      {s.active ? "Deactivate login" : "Reactivate login"}
                    </button>
                  </form>
                </div>
              </div>

              {info ? <EditShopInfoForm shop={info} /> : <p className="text-sm text-zinc-500">No location is linked to this account yet.</p>}
              <EditLoginForm id={s.id} authUserId={s.auth_user_id} mode={username ? "username" : "email"} initialIdentifier={username ?? email} />
            </div>
          ))}
        </MerchantFilter>
        {rows.length === 0 && <p className="text-sm text-zinc-400">No merchants yet. Add the first one above.</p>}
      </section>
    </div>
  );
}

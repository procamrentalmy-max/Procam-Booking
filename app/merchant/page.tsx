import Link from "next/link";
import { getAuthContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { AutoRefresh } from "@/components/droneRental/AutoRefresh";
import { describeDue, formatClock, formatDayLabel, formatDuration } from "@/lib/droneRental/format";
import { walkInView } from "@/lib/droneRental/walkIn";

const NO_SHOPS = "00000000-0000-0000-0000-000000000000";

type BookingRow = {
  id: string;
  human_id: string;
  status: string;
  start_time: string;
  end_time: string;
  shop_id: string;
  drone_id: string;
  customer_id: string;
  checked_in_at: string | null;
  source: string;
};

function Stat({ value, label, tone }: { value: string; label: string; tone?: "alert" }) {
  return (
    <div
      className={`rounded-2xl border p-3 text-center ${
        tone === "alert" ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <p className={`text-2xl font-bold leading-none ${tone === "alert" ? "text-red-700 dark:text-red-300" : "text-black dark:text-zinc-50"}`}>{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
      {title}
      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{count}</span>
    </h2>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-400 dark:border-zinc-700">{children}</p>;
}

function CustomerLine({ name, phone }: { name: string; phone: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-lg font-semibold text-black dark:text-zinc-50">{name}</p>
      <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="text-sm text-zinc-500 underline underline-offset-2">
        {phone}
      </a>
    </div>
  );
}

function DroneChip({ id }: { id: string }) {
  return <span className="shrink-0 rounded-lg bg-black px-2.5 py-1 text-sm font-bold tracking-wide text-white dark:bg-white dark:text-black">{id}</span>;
}

export default async function MerchantHomePage() {
  const ctx = await getAuthContext();
  const supabase = await createServerSupabaseClient();
  const now = new Date();

  // Admin sees every shop; a merchant only sees the shop(s) they're
  // assigned to (dr_merchant_shops) — see 0035_drone_rental_schema.sql.
  let shopIds: string[] | null = null;
  if (ctx?.kind === "merchant") {
    const { data: assignments } = await supabase.from("dr_merchant_shops").select("shop_id").eq("staff_user_id", ctx.staffId);
    shopIds = (assignments ?? []).map((a) => a.shop_id);
  }
  const scoped = shopIds ? (shopIds.length ? shopIds : [NO_SHOPS]) : null;

  const bookingsQuery = supabase
    .from("dr_bookings")
    .select("id,human_id,status,source,start_time,end_time,shop_id,drone_id,customer_id,checked_in_at")
    .in("status", ["CONFIRMED", "ACTIVE"])
    .order("start_time", { ascending: true });
  const dronesQuery = supabase.from("dr_drones").select("id,human_id,status,shop_id,model_key");
  const [{ data: bookingRows }, { data: allDrones }] = await Promise.all([
    scoped ? bookingsQuery.in("shop_id", scoped) : bookingsQuery,
    scoped ? dronesQuery.in("shop_id", scoped) : dronesQuery,
  ]);
  const bookings: BookingRow[] = bookingRows ?? [];
  const drones = allDrones ?? [];

  // Walk-in orders that are still moving: an order from the shop's QR waiting for the merchant to confirm,
  // or a confirmed one not yet paid. Recent only — old accepted ones pile up and are all finished business.
  const walkInsQuery = supabase
    .from("dr_walkin_requests")
    .select("id,status,customer_name,duration_minutes,batteries_count,drone_model,expires_at,booking_id")
    .in("status", ["SUBMITTED", "ACCEPTED"])
    .gte("created_at", new Date(now.getTime() - 24 * 60 * 60_000).toISOString())
    .order("created_at", { ascending: false });
  const { data: walkInRows } = await (scoped ? walkInsQuery.in("shop_id", scoped) : walkInsQuery);
  const acceptedBookingIds = (walkInRows ?? []).filter((w) => w.status === "ACCEPTED" && w.booking_id).map((w) => w.booking_id as string);
  const { data: acceptedBookings } = acceptedBookingIds.length
    ? await supabase.from("dr_bookings").select("id,status").in("id", acceptedBookingIds)
    : { data: [] };
  const bookingStatusById = new Map((acceptedBookings ?? []).map((b) => [b.id, b.status]));
  const walkIns = (walkInRows ?? [])
    .map((w) => ({ ...w, view: walkInView(w.status, new Date(w.expires_at), now) }))
    .filter((w) => w.view === "SUBMITTED" || (w.view === "ACCEPTED" && bookingStatusById.get(w.booking_id ?? "") === "PENDING_PAYMENT"));

  const droneIds = drones.map((d) => d.id);
  const customerIds = [...new Set(bookings.map((b) => b.customer_id))];
  const shopIdsShown = [...new Set(drones.map((d) => d.shop_id))];
  const [{ data: batteries }, { data: customers }, { data: shops }] = await Promise.all([
    droneIds.length ? supabase.from("dr_batteries").select("status").in("drone_id", droneIds) : Promise.resolve({ data: [] }),
    // Names/phones for the cards — read with the service role after the
    // layout's merchant/admin gate, same as the pickup and return pages.
    customerIds.length ? createServiceRoleClient().from("customers").select("id,name,phone").in("id", customerIds) : Promise.resolve({ data: [] }),
    shopIdsShown.length ? supabase.from("dr_shops").select("id,name").in("id", shopIdsShown) : Promise.resolve({ data: [] }),
  ]);

  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));
  // A GT50 is tagged next to its number so it isn't mistaken for a Neo 2 at a glance.
  const droneHumanId = new Map(drones.map((d) => [d.id, d.model_key === "GT50" ? `${d.human_id} · GT50` : d.human_id]));
  const shopNameById = new Map((shops ?? []).map((s) => [s.id, s.name]));
  const showShopName = shopIdsShown.length > 1;

  const pickups = bookings.filter((b) => b.status === "CONFIRMED");
  const outNow = bookings
    .filter((b) => b.status === "ACTIVE")
    .sort((a, b) => new Date(a.end_time).getTime() - new Date(b.end_time).getTime());
  const overdue = outNow.filter((b) => describeDue(new Date(b.end_time), now).overdue);

  const dronesFree = drones.filter((d) => d.status === "AVAILABLE").length;
  const batteriesAtShop = (batteries ?? []).filter((b) => b.status === "AT_SHOP").length;

  return (
    <div className="space-y-5 pb-10 pt-4">
      <AutoRefresh seconds={walkIns.length ? 5 : 30} />

      <Link
        href="/merchant/walk-in-qr"
        className="flex h-14 items-center justify-center rounded-2xl bg-black text-base font-semibold text-white shadow-sm dark:bg-white dark:text-black"
      >
        Walk-in QR
      </Link>

      {walkIns.length > 0 && (
        <section>
          <SectionHeading title="Walk-in orders" count={walkIns.length} />
          <ul className="space-y-3">
            {walkIns.map((w) => {
              const ready = w.view === "SUBMITTED";
              return (
                <li
                  key={w.id}
                  className={`flex items-center justify-between gap-3 rounded-2xl border-2 p-4 ${
                    ready ? "border-green-500 bg-green-50 dark:bg-green-950" : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-base font-semibold leading-snug text-black dark:text-zinc-50">
                      {ready ? `${w.customer_name} sent an order` : `Waiting for ${w.customer_name} to pay`}
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {w.drone_model === "GT50" ? "GT50 · " : ""}{w.duration_minutes / 60}h · {w.batteries_count} {w.batteries_count === 1 ? "battery" : "batteries"}
                    </p>
                  </div>
                  <Link
                    href={`/merchant/walk-in/${w.id}`}
                    className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold ${ready ? "bg-green-600 text-white" : "bg-white text-black dark:bg-zinc-900 dark:text-white"}`}
                  >
                    {ready ? "Review & confirm" : "Open"}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {overdue.length > 0 && (
        <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-4 dark:bg-red-950">
          <p className="text-sm font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
            {overdue.length} overdue — chase {overdue.length === 1 ? "this one" : "these"}
          </p>
          <p className="mt-1 text-base font-semibold text-red-900 dark:text-red-100">
            {overdue
              .map((b) => `${droneHumanId.get(b.drone_id) ?? "—"} · ${customerById.get(b.customer_id)?.name ?? "—"} (${describeDue(new Date(b.end_time), now).label})`)
              .join("  |  ")}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <Stat value={String(pickups.length)} label="To hand over" />
          <Stat value={String(outNow.length)} label="Out now" tone={overdue.length > 0 ? "alert" : undefined} />
          <Stat value={`${dronesFree}/${drones.length}`} label="Drones free" />
        </div>
        <p className="text-center text-xs text-zinc-500">
          Batteries at the shop: <span className="font-semibold">{batteriesAtShop}</span> of {(batteries ?? []).length}
        </p>
      </div>

      <section>
        <SectionHeading title="Ready for pickup" count={pickups.length} />
        {pickups.length ? (
          <ul className="space-y-3">
            {pickups.map((b) => {
              const c = customerById.get(b.customer_id);
              const start = new Date(b.start_time);
              const started = start.getTime() <= now.getTime();
              return (
                <li key={b.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-start justify-between gap-3">
                    <CustomerLine name={c?.name ?? "—"} phone={c?.phone ?? "—"} />
                    <DroneChip id={droneHumanId.get(b.drone_id) ?? "—"} />
                  </div>
                  {b.source === "MERCHANT_INSTANT" ? (
                    <div className="mt-3">
                      <p className="text-xl font-bold leading-none text-black dark:text-zinc-50">Walk-in, paid</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {formatDuration(new Date(b.end_time).getTime() - start.getTime())} rental
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-3xl font-bold leading-none text-black dark:text-zinc-50">{formatClock(start)}</p>
                        <p className="mt-1 text-sm text-zinc-500">{formatDayLabel(start, now)}</p>
                      </div>
                      <p className={`text-sm font-semibold ${started ? "text-amber-700 dark:text-amber-400" : "text-zinc-600 dark:text-zinc-400"}`}>
                        {started ? `Start time passed ${formatDuration(now.getTime() - start.getTime())} ago` : `Starts in ${formatDuration(start.getTime() - now.getTime())}`}
                      </p>
                    </div>
                  )}
                  <Link
                    href={`/merchant/pickup/${b.id}`}
                    className="mt-4 flex h-12 items-center justify-center rounded-xl bg-black text-base font-semibold text-white dark:bg-white dark:text-black"
                  >
                    Hand over
                  </Link>
                  <p className="mt-2 text-xs text-zinc-400">
                    {b.human_id}
                    {b.checked_in_at ? " · Order accepted" : ""}
                    {showShopName ? ` · ${shopNameById.get(b.shop_id) ?? ""}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No pickups waiting.</Empty>
        )}
      </section>

      <section>
        <SectionHeading title="Out on rental" count={outNow.length} />
        {outNow.length ? (
          <ul className="space-y-3">
            {outNow.map((b) => {
              const c = customerById.get(b.customer_id);
              const due = new Date(b.end_time);
              const status = describeDue(due, now);
              return (
                <li
                  key={b.id}
                  className={`rounded-2xl border p-4 shadow-sm ${
                    status.overdue ? "border-2 border-red-500 bg-red-50 dark:bg-red-950" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <CustomerLine name={c?.name ?? "—"} phone={c?.phone ?? "—"} />
                    <DroneChip id={droneHumanId.get(b.drone_id) ?? "—"} />
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Due back</p>
                      <p className="text-3xl font-bold leading-none text-black dark:text-zinc-50">{formatClock(due)}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-bold ${
                        status.overdue ? "bg-red-600 text-white" : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      }`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                    <Link
                      href={`/merchant/return/${b.id}`}
                      className="flex h-12 items-center justify-center rounded-xl bg-black text-base font-semibold text-white dark:bg-white dark:text-black"
                    >
                      Return
                    </Link>
                    <Link
                      href={`/merchant/battery-swap/${b.id}`}
                      className="flex h-12 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-semibold dark:border-zinc-700 dark:bg-zinc-900"
                    >
                      Swap battery
                    </Link>
                  </div>
                  <p className="mt-2 text-xs text-zinc-400">
                    {b.human_id}
                    {showShopName ? ` · ${shopNameById.get(b.shop_id) ?? ""}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>Nothing out on rental.</Empty>
        )}
      </section>
    </div>
  );
}

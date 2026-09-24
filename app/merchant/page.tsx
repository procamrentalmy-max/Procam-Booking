import Link from "next/link";
import { getAuthContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatMalaysiaTime } from "@/lib/i18n/locale";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="mb-2 text-sm font-semibold text-black dark:text-zinc-50">{title}</h2>
      {children}
    </section>
  );
}

function EmptyState() {
  return <p className="text-sm text-zinc-400">Nothing here right now.</p>;
}

export default async function MerchantHomePage() {
  const ctx = await getAuthContext();
  const supabase = await createServerSupabaseClient();

  // Admin sees every shop; a merchant only sees the shop(s) they're
  // assigned to (dr_merchant_shops) — see 0035_drone_rental_schema.sql.
  let shopIds: string[] | null = null;
  if (ctx?.kind === "merchant") {
    const { data: assignments } = await supabase.from("dr_merchant_shops").select("shop_id").eq("staff_user_id", ctx.staffId);
    shopIds = (assignments ?? []).map((a) => a.shop_id);
  }

  const bookingsQuery = supabase
    .from("dr_bookings")
    .select("id,human_id,status,start_time,end_time,shop_id,drone_id")
    .in("status", ["CONFIRMED", "ACTIVE"])
    .order("start_time", { ascending: true });
  const { data: bookings } = shopIds ? await bookingsQuery.in("shop_id", shopIds.length ? shopIds : ["00000000-0000-0000-0000-000000000000"]) : await bookingsQuery;

  const shopIdsToLoad = [...new Set((bookings ?? []).map((b) => b.shop_id))];
  const droneIdsToLoad = [...new Set((bookings ?? []).map((b) => b.drone_id))];
  const [{ data: shops }, { data: drones }] = await Promise.all([
    shopIdsToLoad.length ? supabase.from("dr_shops").select("id,name").in("id", shopIdsToLoad) : Promise.resolve({ data: [] }),
    droneIdsToLoad.length ? supabase.from("dr_drones").select("id,human_id").in("id", droneIdsToLoad) : Promise.resolve({ data: [] }),
  ]);
  const shopNameById = new Map((shops ?? []).map((s) => [s.id, s.name]));
  const droneHumanIdById = new Map((drones ?? []).map((d) => [d.id, d.human_id]));

  const pickups = (bookings ?? []).filter((b) => b.status === "CONFIRMED");
  const active = (bookings ?? []).filter((b) => b.status === "ACTIVE");

  return (
    <div className="space-y-4 pb-8 pt-4">
      <Link
        href="/merchant/instant-booking"
        className="flex h-12 items-center justify-center rounded-full bg-black text-sm font-semibold text-white dark:bg-white dark:text-black"
      >
        New Walk-In Booking
      </Link>

      <Section title="Ready for Pickup">
        {pickups.length ? (
          <ul className="space-y-2 text-sm">
            {pickups.map((b) => (
              <li key={b.id} className="flex items-center justify-between">
                <span>
                  {b.human_id} — {droneHumanIdById.get(b.drone_id) ?? "—"} — {shopNameById.get(b.shop_id) ?? "—"} —{" "}
                  {formatMalaysiaTime(new Date(b.start_time), "en")}
                </span>
                <Link href={`/merchant/pickup/${b.id}`} className="shrink-0 underline underline-offset-2">
                  Hand over
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </Section>

      <Section title="Out on Rental">
        {active.length ? (
          <ul className="space-y-2 text-sm">
            {active.map((b) => (
              <li key={b.id} className="flex items-center justify-between">
                <span>
                  {b.human_id} — {droneHumanIdById.get(b.drone_id) ?? "—"} — due{" "}
                  {formatMalaysiaTime(new Date(b.end_time), "en")}
                </span>
                <div className="flex shrink-0 gap-3">
                  <Link href={`/merchant/battery-swap/${b.id}`} className="underline underline-offset-2">
                    Swap battery
                  </Link>
                  <Link href={`/merchant/return/${b.id}`} className="underline underline-offset-2">
                    Return
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </Section>
    </div>
  );
}

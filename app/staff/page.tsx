import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

export default async function StaffDashboard() {
  const supabase = await createServerSupabaseClient();

  const [
    { data: upcomingBookings },
    { data: returnsAwaitingInspection },
    { data: chargingAssets },
    { data: maintenanceAssets },
    { data: availableAssets },
    { data: batteries },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("human_id,status,start_time,end_time,partner_id")
      .in("status", ["CONFIRMED", "READY_FOR_PICKUP", "ACTIVE"])
      .order("start_time", { ascending: true })
      .limit(10),
    supabase.from("rental_assets").select("id,human_id,partner_id").eq("status", "RETURNED_AWAITING_INSPECTION"),
    supabase.from("rental_assets").select("human_id").eq("status", "CHARGING"),
    supabase.from("rental_assets").select("human_id,notes").eq("status", "MAINTENANCE"),
    supabase.from("rental_assets").select("human_id").eq("status", "AVAILABLE"),
    supabase.from("batteries").select("human_id,status").order("status"),
  ]);

  return (
    <div className="space-y-4 pb-8 pt-4">
      <Section title="Today's Pickups & Upcoming Bookings">
        {upcomingBookings?.length ? (
          <ul className="space-y-1 text-sm">
            {upcomingBookings.map((b) => (
              <li key={b.human_id}>
                {b.human_id} — {b.status} — {new Date(b.start_time).toLocaleString()}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </Section>

      <Section title="Returns Waiting for Inspection">
        {returnsAwaitingInspection?.length ? (
          <ul className="space-y-1 text-sm">
            {returnsAwaitingInspection.map((a) => (
              <li key={a.human_id}>
                <Link href={`/staff/inspections/${a.id}`} className="underline underline-offset-2">
                  {a.human_id}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </Section>

      <Section title="Equipment Needing Charge">
        {chargingAssets?.length ? (
          <ul className="space-y-1 text-sm">
            {chargingAssets.map((a) => (
              <li key={a.human_id}>{a.human_id}</li>
            ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </Section>

      <Section title="Maintenance">
        {maintenanceAssets?.length ? (
          <ul className="space-y-1 text-sm">
            {maintenanceAssets.map((a) => (
              <li key={a.human_id}>
                {a.human_id}
                {a.notes ? ` — ${a.notes}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </Section>

      <Section title="Equipment Available by Property">
        {availableAssets?.length ? (
          <ul className="space-y-1 text-sm">
            {availableAssets.map((a) => (
              <li key={a.human_id}>{a.human_id}</li>
            ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </Section>

      <Section title="Battery Inventory">
        {batteries?.length ? (
          <ul className="space-y-1 text-sm">
            {batteries.map((b) => (
              <li key={b.human_id}>
                {b.human_id} — {b.status}
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

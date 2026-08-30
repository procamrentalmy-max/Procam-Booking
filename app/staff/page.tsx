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
    { data: chargingCameras },
    { data: maintenanceCameras },
    { data: availableCameras },
    { data: batteries },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("human_id,status,start_time,end_time,partner_id")
      .in("status", ["CONFIRMED", "READY_FOR_PICKUP", "ACTIVE"])
      .order("start_time", { ascending: true })
      .limit(10),
    supabase.from("cameras").select("human_id,partner_id").eq("status", "RETURNED_AWAITING_INSPECTION"),
    supabase.from("cameras").select("human_id").eq("status", "CHARGING"),
    supabase.from("cameras").select("human_id,notes").eq("status", "MAINTENANCE"),
    supabase.from("cameras").select("human_id").eq("status", "AVAILABLE"),
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
            {returnsAwaitingInspection.map((c) => (
              <li key={c.human_id}>{c.human_id}</li>
            ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </Section>

      <Section title="Cameras Needing Charge">
        {chargingCameras?.length ? (
          <ul className="space-y-1 text-sm">
            {chargingCameras.map((c) => (
              <li key={c.human_id}>{c.human_id}</li>
            ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </Section>

      <Section title="Maintenance">
        {maintenanceCameras?.length ? (
          <ul className="space-y-1 text-sm">
            {maintenanceCameras.map((c) => (
              <li key={c.human_id}>
                {c.human_id}
                {c.notes ? ` — ${c.notes}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState />
        )}
      </Section>

      <Section title="Cameras Available by Property">
        {availableCameras?.length ? (
          <ul className="space-y-1 text-sm">
            {availableCameras.map((c) => (
              <li key={c.human_id}>{c.human_id}</li>
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

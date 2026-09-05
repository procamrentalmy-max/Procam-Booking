import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DamageCasesPage() {
  const supabase = await createServerSupabaseClient();

  const [{ data: openCases }, { data: resolvedCases }] = await Promise.all([
    supabase
      .from("damage_cases")
      .select("id,booking_id,category,description,status,created_at")
      .in("status", ["OPEN", "UNDER_REVIEW"])
      .order("created_at", { ascending: true }),
    supabase
      .from("damage_cases")
      .select("id,booking_id,category,status,resolved_at,deposit_action")
      .eq("status", "RESOLVED")
      .order("resolved_at", { ascending: false })
      .limit(20),
  ]);

  const bookingIds = [...new Set([...(openCases ?? []), ...(resolvedCases ?? [])].map((c) => c.booking_id))];
  const { data: bookings } = bookingIds.length
    ? await supabase.from("bookings").select("id,human_id,asset_id").in("id", bookingIds)
    : { data: [] };
  const bookingById = new Map((bookings ?? []).map((b) => [b.id, b]));

  const assetIds = [...new Set((bookings ?? []).map((b) => b.asset_id))];
  const { data: assets } = assetIds.length
    ? await supabase.from("rental_assets").select("id,human_id").in("id", assetIds)
    : { data: [] };
  const assetHumanIdByAssetId = new Map((assets ?? []).map((a) => [a.id, a.human_id]));

  function assetLabel(bookingId: string): string {
    const booking = bookingById.get(bookingId);
    if (!booking) return "Unknown asset";
    return assetHumanIdByAssetId.get(booking.asset_id) ?? "Unknown asset";
  }

  return (
    <div className="space-y-6 pt-4">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500">Needs Resolution</h2>
        {openCases?.length ? (
          openCases.map((c) => (
            <Link
              key={c.id}
              href={`/admin/damage-cases/${c.id}`}
              className="block rounded-xl border border-red-200 p-4 hover:border-red-400 dark:border-red-900"
            >
              <p className="font-medium">
                {assetLabel(c.booking_id)} — {bookingById.get(c.booking_id)?.human_id ?? "Unknown booking"}
              </p>
              <p className="text-sm text-zinc-500">
                {c.category.replace(/_/g, " ")} — {c.description}
              </p>
              <p className="mt-1 text-xs text-zinc-400">Reported {new Date(c.created_at).toLocaleString()}</p>
            </Link>
          ))
        ) : (
          <p className="text-sm text-zinc-400">Nothing to resolve.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500">Recently Resolved</h2>
        {resolvedCases?.length ? (
          resolvedCases.map((c) => (
            <div key={c.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="font-medium">
                {assetLabel(c.booking_id)} — {bookingById.get(c.booking_id)?.human_id ?? "Unknown booking"}
              </p>
              <p className="text-sm text-zinc-500">
                Deposit action: {c.deposit_action} — resolved{" "}
                {c.resolved_at ? new Date(c.resolved_at).toLocaleString() : "—"}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-400">None yet.</p>
        )}
      </section>
    </div>
  );
}

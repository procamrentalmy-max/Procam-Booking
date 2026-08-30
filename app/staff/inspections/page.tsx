import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function InspectionsListPage() {
  const supabase = await createServerSupabaseClient();
  const { data: cameras } = await supabase
    .from("cameras")
    .select("id,human_id,partner_id")
    .eq("status", "RETURNED_AWAITING_INSPECTION")
    .order("human_id");

  const { data: partners } = await supabase.from("partners").select("id,name");
  const partnerName = new Map((partners ?? []).map((p) => [p.id, p.name]));

  return (
    <div className="space-y-3 pt-4">
      <h1 className="text-lg font-semibold">Returns Waiting for Inspection</h1>
      {(cameras ?? []).map((camera) => (
        <Link
          key={camera.id}
          href={`/staff/inspections/${camera.id}`}
          className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <span className="font-medium">{camera.human_id}</span>
          <span className="text-sm text-zinc-500">
            {camera.partner_id ? partnerName.get(camera.partner_id) : "—"}
          </span>
        </Link>
      ))}
      {!cameras?.length && <p className="text-sm text-zinc-400">Nothing waiting for inspection.</p>}
    </div>
  );
}

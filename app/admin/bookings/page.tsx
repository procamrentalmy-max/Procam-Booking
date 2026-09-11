import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { primaryButtonClass } from "@/components/formStyles";
import { forceConfirmBookingAction } from "./actions";

export default async function BookingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id,human_id,status,start_time,end_time,customer_id,partner_id,dropoff_partner_id,asset_id")
    .order("created_at", { ascending: false });

  const [{ data: customers }, { data: partners }, { data: assets }] = await Promise.all([
    supabase.from("customers").select("id,name,email"),
    supabase.from("partners").select("id,name"),
    supabase.from("rental_assets").select("id,human_id"),
  ]);

  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));
  const partnerById = new Map((partners ?? []).map((p) => [p.id, p]));
  const assetById = new Map((assets ?? []).map((a) => [a.id, a]));

  return (
    <div className="space-y-3 pt-4">
      {(bookings ?? []).map((b) => (
        <div key={b.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="font-medium">
            <Link href={`/admin/bookings/${b.id}`} className="underline underline-offset-2">
              {b.human_id}
            </Link>{" "}
            — <span className="font-normal text-zinc-500">{b.status}</span>
          </p>
          <p className="text-sm text-zinc-500">
            {customerById.get(b.customer_id)?.name ?? "Unknown customer"} at{" "}
            {partnerById.get(b.partner_id)?.name ?? "Unknown property"}
            {b.dropoff_partner_id !== b.partner_id && (
              <> → {partnerById.get(b.dropoff_partner_id)?.name ?? "Unknown property"}</>
            )}{" "}
            — {assetById.get(b.asset_id)?.human_id}
          </p>
          <p className="text-xs text-zinc-400">
            {new Date(b.start_time).toLocaleString()} → {new Date(b.end_time).toLocaleString()}
          </p>
          {b.status === "PENDING_PAYMENT" && (
            <form action={forceConfirmBookingAction} className="mt-2">
              <input type="hidden" name="id" value={b.id} />
              <button type="submit" className={primaryButtonClass}>
                Force Confirm (bypass Stripe — dev/testing only)
              </button>
            </form>
          )}
        </div>
      ))}
      {!bookings?.length && <p className="text-sm text-zinc-400">No bookings yet.</p>}
    </div>
  );
}

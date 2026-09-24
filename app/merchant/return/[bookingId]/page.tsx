import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { ReturnForm } from "./ReturnForm";

export default async function MerchantReturnPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("dr_bookings").select("id,status,customer_id,drone_id").eq("id", bookingId).maybeSingle();
  if (!booking) notFound();

  const [{ data: customer }, { data: drone }, { data: items }] = await Promise.all([
    supabase.from("customers").select("name,phone").eq("id", booking.customer_id).single(),
    supabase.from("dr_drones").select("human_id").eq("id", booking.drone_id).single(),
    supabase.from("dr_checklist_items").select("item_key,label").eq("active", true).order("sort_order"),
  ]);

  return (
    <div className="space-y-4 pt-4">
      <div className="rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <p className="font-medium text-black dark:text-zinc-50">{customer?.name ?? "—"}</p>
        <p className="text-zinc-500">{customer?.phone ?? "—"}</p>
        <p className="mt-1 text-zinc-500">Drone {drone?.human_id ?? "—"}</p>
      </div>
      <ReturnForm bookingId={booking.id} checklistItems={items ?? []} disabled={booking.status !== "ACTIVE"} />
    </div>
  );
}

import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { modelProfile } from "@/lib/droneRental/pricingRules";
import { batteryLabel } from "@/lib/droneRental/format";
import { ReturnForm } from "./ReturnForm";

export default async function MerchantReturnPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("dr_bookings").select("id,status,customer_id,drone_id,batteries_count,drone_model").eq("id", bookingId).maybeSingle();
  if (!booking) notFound();
  const profile = modelProfile(booking.drone_model);

  const [{ data: customer }, { data: drone }, { data: items }, { data: hold }, { data: heldBatteries }, { data: controller }] = await Promise.all([
    supabase.from("customers").select("name,phone").eq("id", booking.customer_id).single(),
    supabase.from("dr_drones").select("human_id").eq("id", booking.drone_id).single(),
    supabase.from("dr_checklist_items").select("item_key,label").eq("active", true).contains("applies_to", [profile.key]).order("sort_order"),
    supabase.from("dr_deposit_authorizations").select("status").eq("booking_id", bookingId).maybeSingle(),
    supabase.from("dr_batteries").select("id,human_id,name").eq("current_booking_id", bookingId).eq("status", "WITH_CUSTOMER").order("human_id"),
    supabase.from("dr_controllers").select("human_id").eq("drone_id", booking.drone_id).maybeSingle(),
  ]);

  return (
    <div className="space-y-4 pt-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-lg font-semibold text-black dark:text-zinc-50">{customer?.name ?? "—"}</p>
        <p className="text-sm text-zinc-500">{customer?.phone ?? "—"}</p>
        <p className="mt-2 inline-block rounded-md bg-zinc-100 px-2 py-1 text-sm font-semibold dark:bg-zinc-800">
          {drone?.human_id ?? "—"} · {profile.shortName}
        </p>
        {booking.status === "ACTIVE" && controller && (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Controller: <span className="font-semibold text-black dark:text-zinc-50">{controller.human_id}</span>
          </p>
        )}
        {booking.status === "ACTIVE" && (heldBatteries ?? []).length > 0 && (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Take back: <span className="font-semibold text-black dark:text-zinc-50">{(heldBatteries ?? []).map(batteryLabel).join(" and ")}</span>
          </p>
        )}
      </div>
      <ReturnForm
        bookingId={booking.id}
        checklistItems={items ?? []}
        disabled={booking.status !== "ACTIVE"}
        holdOnFile={hold?.status === "AUTHORIZED"}
        model={profile.key}
        controllerCode={controller?.human_id ?? null}
      />
    </div>
  );
}

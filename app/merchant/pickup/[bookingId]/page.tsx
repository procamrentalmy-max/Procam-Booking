import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { formatMyr, modelProfile } from "@/lib/droneRental/pricingRules";
import { PickupForm } from "./PickupForm";

export default async function MerchantPickupPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("dr_bookings")
    .select("id,status,customer_id,drone_id,start_time,end_time,deposit_myr,batteries_count,drone_model")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) notFound();
  const profile = modelProfile(booking.drone_model);

  const [{ data: customer }, { data: drone }, { data: items }, { data: hold }] = await Promise.all([
    supabase.from("customers").select("name,phone").eq("id", booking.customer_id).single(),
    supabase.from("dr_drones").select("human_id").eq("id", booking.drone_id).single(),
    supabase.from("dr_checklist_items").select("item_key,label").eq("active", true).contains("applies_to", [profile.key]).order("sort_order"),
    supabase.from("dr_deposit_authorizations").select("status").eq("booking_id", bookingId).maybeSingle(),
  ]);

  const holdOnFile = hold?.status === "AUTHORIZED";

  const summary = (
    <>
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-lg font-semibold text-black dark:text-zinc-50">{customer?.name ?? "—"}</p>
        <p className="text-sm text-zinc-500">{customer?.phone ?? "—"}</p>
      </div>

      <div className="rounded-2xl border-2 border-black bg-white p-4 dark:border-white dark:bg-zinc-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Hand over</p>
        <ul className="mt-2 space-y-1 text-base font-semibold text-black dark:text-zinc-50">
          <li>
            Drone {drone?.human_id ?? "—"} <span className="font-normal text-zinc-500">({profile.shortName})</span>
          </li>
          <li>{profile.controllerName}</li>
          <li>
            {booking.batteries_count} {booking.batteries_count === 1 ? "battery" : "batteries"}{" "}
            <span className="font-normal text-zinc-500">{booking.batteries_count === 1 ? "(in the drone)" : "(one in the drone, one spare)"}</span>
          </li>
        </ul>
        <p className="mt-2 text-xs text-zinc-500">Nothing else goes out — no case, no charging cable.</p>
      </div>

      {holdOnFile ? (
        <p className="rounded-xl border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <span className="font-semibold">Deposit held: {formatMyr(booking.deposit_myr)}</span> (drone {formatMyr(profile.depositDroneMyr)} + controller{" "}
          {formatMyr(profile.depositControllerMyr)})
        </p>
      ) : (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <span className="font-semibold">No card hold on file</span> for this booking — expected deposit is {formatMyr(booking.deposit_myr)}. Sort that out
          before handing anything over.
        </p>
      )}
    </>
  );

  return (
    <div className="space-y-4 pt-4">
      <PickupForm
        bookingId={booking.id}
        checklistItems={items ?? []}
        disabled={booking.status !== "CONFIRMED"}
        batteriesCount={booking.batteries_count}
        photosRequired={profile.photosRequired}
        summary={summary}
      />
    </div>
  );
}

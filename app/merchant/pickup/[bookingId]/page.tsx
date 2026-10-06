import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { controllerDepositFor, controllerProfileFor, formatMyr, includesController, modelProfile, storedController } from "@/lib/droneRental/pricingRules";
import { listChargedBatteries } from "@/lib/droneRental/batteries";
import { batteryLabel } from "@/lib/droneRental/format";
import { checklistForRental } from "@/lib/droneRental/checklist";
import { PickupForm } from "./PickupForm";

export default async function MerchantPickupPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("dr_bookings")
    .select("id,status,customer_id,drone_id,start_time,end_time,deposit_myr,batteries_count,drone_model,controller_kind,controller_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) notFound();
  const profile = modelProfile(booking.drone_model);
  // A drone rented without a controller goes out as the drone and batteries only.
  const controller = storedController(booking.drone_model, booking.controller_kind);
  const withController = includesController(booking.drone_model, controller);
  const controllerProfile = controllerProfileFor(booking.drone_model, controller);

  const [{ data: customer }, { data: drone }, { data: items }, { data: hold }, { data: controllerUnit }] = await Promise.all([
    supabase.from("customers").select("name,phone").eq("id", booking.customer_id).single(),
    supabase.from("dr_drones").select("human_id").eq("id", booking.drone_id).single(),
    supabase.from("dr_checklist_items").select("item_key,label").eq("active", true).contains("applies_to", [profile.key]).order("sort_order"),
    supabase.from("dr_deposit_authorizations").select("status").eq("booking_id", bookingId).maybeSingle(),
    // The shop's controller set aside for this booking when it was made (older bookings have none recorded).
    booking.controller_id ? supabase.from("dr_controllers").select("human_id").eq("id", booking.controller_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const holdOnFile = hold?.status === "AUTHORIZED";

  // Every charged battery at the shop that fits this drone: the merchant picks which ones to hand out.
  const options = booking.status === "CONFIRMED" ? await listChargedBatteries(booking.drone_id) : [];

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
          {withController ? (
            <li>
              {controllerUnit ? `${controllerProfile?.name} ${controllerUnit.human_id}` : controllerProfile?.name}
            </li>
          ) : (
            <li>
              No controller <span className="font-normal text-zinc-500">(the customer flies it from their own phone)</span>
            </li>
          )}
          <li>
            {booking.batteries_count} {booking.batteries_count === 1 ? "battery" : "batteries"} <span className="font-normal text-zinc-500">(you pick them below)</span>
          </li>
        </ul>
        <p className="mt-2 text-xs text-zinc-500">Nothing else goes out — no case, no charging cable.</p>
      </div>

      {holdOnFile ? (
        <p className="rounded-xl border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <span className="font-semibold">Deposit held: {formatMyr(booking.deposit_myr)}</span> ({withController ? <>drone {formatMyr(profile.depositDroneMyr)} + {controllerProfile?.shortName} {formatMyr(controllerDepositFor(booking.drone_model, controller))}</> : <>drone only</>})
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
        checklistItems={checklistForRental(items ?? [], controller)}
        disabled={booking.status !== "CONFIRMED"}
        batteriesCount={booking.batteries_count}
        photosRequired={profile.photosRequired}
        model={profile.key}
        controller={controller}
        batteryOptions={options.map((b) => ({ id: b.id, label: batteryLabel(b) }))}
        summary={summary}
      />
    </div>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getAuthContext, hasStaffAccess } from "@/lib/auth/session";
import { getNextStopForStaff } from "@/lib/worker/route";

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export type CompletedStopResult = {
  partnerName: string;
  pickedUp: { humanId: string }[];
  droppedOff: { humanId: string; compartmentNumber: number; pin: string }[];
  toInspect: { humanId: string; assetId: string }[];
};

/**
 * Executes every action at the worker's current next stop (freshly
 * recomputed, not whatever the client last rendered — the plan can only
 * be trusted at the instant it's acted on) and advances the worker's
 * position. DROPOFF assigns the asset to the first empty compartment at
 * that locker and generates a new PIN, which the worker then has to
 * physically set on the lock — the system is the source of truth for
 * what the PIN *should* be, not a verified confirmation it was set (spec
 * section 1: no electronics, no API). SERVICE is intentionally not a
 * database action here — a "serviced" camera still needs the existing,
 * already-built formal staff inspection flow (deposit release / damage
 * handling) rather than a shortcut around it; the UI links there instead.
 */
export async function completeStopAction(): Promise<CompletedStopResult> {
  const ctx = await getAuthContext();
  if (!hasStaffAccess(ctx)) throw new Error("Not authorized.");

  // Ownership check via the RLS-scoped client first, same pattern used
  // everywhere else a privileged write follows a staff-identity check.
  const rlsClient = await createServerSupabaseClient();
  const { data: worker } = await rlsClient
    .from("workers")
    .select("id,active")
    .eq("staff_user_id", ctx.staffId)
    .maybeSingle();
  if (!worker) throw new Error("You're not set up as a worker.");
  if (!worker.active) throw new Error("Your worker profile is inactive.");

  const result = await getNextStopForStaff(ctx.staffId);
  if (result.error) throw new Error("Could not compute your route.");
  if (!result.nextStop) throw new Error("No stop is currently needed.");

  const { partnerId, partnerName, actions } = result.nextStop;
  const supabase = createServiceRoleClient();

  const pickedUp: CompletedStopResult["pickedUp"] = [];
  const droppedOff: CompletedStopResult["droppedOff"] = [];
  const toInspect: CompletedStopResult["toInspect"] = [];

  for (const action of actions) {
    if (action.type === "PICKUP") {
      for (const asset of action.assets) {
        const { data: compartment } = await supabase
          .from("locker_compartments")
          .select("id")
          .eq("current_asset_id", asset.id)
          .maybeSingle();
        if (compartment) {
          await supabase
            .from("locker_compartments")
            .update({ current_asset_id: null, current_pin: null })
            .eq("id", compartment.id);
        }
        const { error } = await supabase.from("rental_assets").update({ partner_id: null }).eq("id", asset.id);
        if (error) throw new Error(error.message);
        pickedUp.push({ humanId: asset.humanId });
      }
    }

    if (action.type === "DROPOFF") {
      for (const asset of action.assets) {
        const { data: lockerRows } = await supabase.from("lockers").select("id").eq("partner_id", partnerId);
        const lockerIds = (lockerRows ?? []).map((l) => l.id);
        const { data: emptyCompartment } = lockerIds.length
          ? await supabase
              .from("locker_compartments")
              .select("id,compartment_number")
              .in("locker_id", lockerIds)
              .is("current_asset_id", null)
              .order("compartment_number", { ascending: true })
              .limit(1)
              .maybeSingle()
          : { data: null };
        if (!emptyCompartment) throw new Error(`No empty compartment available at ${partnerName}.`);

        const pin = generatePin();
        const { error: compartmentError } = await supabase
          .from("locker_compartments")
          .update({ current_asset_id: asset.id, current_pin: pin })
          .eq("id", emptyCompartment.id);
        if (compartmentError) throw new Error(compartmentError.message);

        const { error: assetError } = await supabase
          .from("rental_assets")
          .update({ partner_id: partnerId })
          .eq("id", asset.id);
        if (assetError) throw new Error(assetError.message);

        droppedOff.push({ humanId: asset.humanId, compartmentNumber: emptyCompartment.compartment_number, pin });
      }
    }

    if (action.type === "SERVICE") {
      // Only SERVICE routes an asset to inspection — a bare PICKUP means
      // it's collected but still raw in the van, serviced (and therefore
      // due for formal inspection) at a later stop, per the engine's own
      // deferred-servicing design (routing.ts).
      for (const asset of action.assets) {
        toInspect.push({ humanId: asset.humanId, assetId: asset.id });
      }
    }
  }

  await supabase.from("workers").update({ current_partner_id: partnerId }).eq("id", worker.id);

  revalidatePath("/staff/route");

  return { partnerName, pickedUp, droppedOff, toInspect };
}

const updateLocationSchema = z.object({ partnerId: uuidSchema });

/**
 * Lets the worker directly declare where they are right now, independent of
 * completing a stop — otherwise current_partner_id only ever moves forward
 * by finishing whatever the plan already said to do, with no way to correct
 * it (e.g. after a day off, or if the worker's actual position drifted from
 * what the system assumed). This becomes the starting point the next route
 * plan is computed from.
 */
export async function updateMyLocationAction(formData: FormData) {
  const parsed = updateLocationSchema.parse({ partnerId: formData.get("partnerId") });
  const ctx = await getAuthContext();
  if (!hasStaffAccess(ctx)) throw new Error("Not authorized.");

  const rlsClient = await createServerSupabaseClient();
  const { data: worker } = await rlsClient
    .from("workers")
    .select("id")
    .eq("staff_user_id", ctx.staffId)
    .maybeSingle();
  if (!worker) throw new Error("You're not set up as a worker.");

  const { error } = await rlsClient
    .from("workers")
    .update({ current_partner_id: parsed.partnerId })
    .eq("id", worker.id);
  if (error) throw new Error(error.message);

  revalidatePath("/staff/route");
}

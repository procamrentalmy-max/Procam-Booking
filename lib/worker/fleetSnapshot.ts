import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { FleetSnapshot } from "@/lib/locker-engine/types";

/**
 * Builds a FleetSnapshot for the worker's route planning — unlike
 * lib/booking/lockerSnapshot.ts (scoped to one product, since a booking
 * request is always for one package), the worker's route has to span
 * every product's assets at every locker location, since one worker
 * services the whole fleet regardless of what camera it is.
 *
 * `compartments` is still left empty here: routing.ts's planRoute and
 * collection.ts's selectCamerasForCollection don't read it — only the
 * physical PIN/compartment-assignment step (app/staff/route/actions.ts)
 * needs that, and it queries locker_compartments directly there.
 */
export async function buildWorkerFleetSnapshot(): Promise<FleetSnapshot> {
  const supabase = createServiceRoleClient();

  const [{ data: assets }, { data: locationRows }, { data: travelTimeRows }, { data: workerRows }, { data: overnightPackages }] = await Promise.all([
    supabase.from("rental_assets").select("id,human_id,is_hot_spare,partner_id,status"),
    supabase.from("partners").select("id").eq("pickup_method", "LOCKER").eq("status", "ACTIVE"),
    supabase.from("location_travel_times").select("from_partner_id,to_partner_id,minutes"),
    supabase.from("workers").select("id,current_partner_id,active"),
    supabase.from("rental_packages").select("id").eq("is_overnight", true),
  ]);
  const overnightPackageIds = new Set((overnightPackages ?? []).map((p) => p.id));

  const assetIds = (assets ?? []).map((a) => a.id);
  const { data: bookingRows } = assetIds.length
    ? await supabase
        .from("bookings")
        .select("id,asset_id,partner_id,dropoff_partner_id,rental_package_id,status,start_time,end_time")
        .in("asset_id", assetIds)
        .not("status", "in", "(CANCELLED,EXPIRED,COMPLETED)")
    : { data: [] };

  return {
    assets: (assets ?? []).map((a) => ({
      id: a.id,
      humanId: a.human_id,
      isHotSpare: a.is_hot_spare,
      partnerId: a.partner_id,
      status: a.status,
    })),
    bookings: (bookingRows ?? []).map((b) => ({
      id: b.id,
      assetId: b.asset_id,
      partnerId: b.partner_id,
      dropoffPartnerId: b.dropoff_partner_id,
      status: b.status,
      startTime: new Date(b.start_time),
      endTime: new Date(b.end_time),
      isOvernight: overnightPackageIds.has(b.rental_package_id),
    })),
    compartments: [],
    workers: (workerRows ?? []).map((w) => ({
      id: w.id,
      currentPartnerId: w.current_partner_id,
      active: w.active,
    })),
    locations: (locationRows ?? []).map((l) => ({ partnerId: l.id })),
    travelTimes: (travelTimeRows ?? []).map((t) => ({
      fromPartnerId: t.from_partner_id,
      toPartnerId: t.to_partner_id,
      minutes: t.minutes,
    })),
  };
}

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { ASSET_TURNAROUND_MINUTES } from "@/lib/locker-engine/feasibility";
import type { FleetSnapshot } from "@/lib/locker-engine/types";

/**
 * Builds a FleetSnapshot for the locker engine from live Supabase data,
 * scoped to one product (a booking request is always for one product's
 * packages). Fetches every non-terminal booking for that product's
 * assets — fine at current scale; will need date-bounding once booking
 * volume grows enough that this starts pulling significant history.
 *
 * `compartments` is always empty here: nothing in the booking-feasibility
 * gate (checkLockerBookingFeasibility / checkOvernightBookingFeasibility)
 * reads it — that's only relevant to the worker's physical locker
 * interactions (a later phase), not to deciding whether a slot is free.
 */
export async function buildLockerFleetSnapshot(productId: string): Promise<FleetSnapshot> {
  const supabase = createServiceRoleClient();

  const [{ data: assets }, { data: locationRows }, { data: travelTimeRows }, { data: workerRows }, { data: overnightPackages }] = await Promise.all([
    supabase.from("rental_assets").select("id,human_id,is_hot_spare,partner_id,status").eq("product_id", productId),
    supabase.from("partners").select("id").eq("pickup_method", "LOCKER").eq("status", "ACTIVE"),
    supabase.from("location_travel_times").select("from_partner_id,to_partner_id,minutes"),
    supabase.from("workers").select("id,current_partner_id,active"),
    supabase.from("rental_packages").select("id").eq("is_overnight", true),
  ]);
  const overnightPackageIds = new Set((overnightPackages ?? []).map((p) => p.id));

  // Unlike lib/worker/fleetSnapshot.ts, this snapshot feeds
  // checkLockerBookingFeasibility -> findEligibleAsset -> isAssetReadyFor,
  // which needs to see COMPLETED bookings to enforce the 2-hour turnaround
  // buffer (a booking that's fully finished is exactly the case that buffer
  // exists for). Only CANCELLED/EXPIRED never occupied the asset at all.
  // Bounded to bookings whose end_time is still within (or after) the
  // buffer window, since nothing older can affect either the buffer check
  // or a real time-overlap — keeps this from re-growing into an unbounded
  // full-history fetch as COMPLETED bookings pile up.
  const snapshotCutoff = new Date(Date.now() - ASSET_TURNAROUND_MINUTES * 60_000).toISOString();
  const assetIds = (assets ?? []).map((a) => a.id);
  const { data: bookingRows } = assetIds.length
    ? await supabase
        .from("bookings")
        .select("id,asset_id,partner_id,dropoff_partner_id,rental_package_id,status,start_time,end_time")
        .in("asset_id", assetIds)
        .not("status", "in", "(CANCELLED,EXPIRED)")
        .gte("end_time", snapshotCutoff)
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

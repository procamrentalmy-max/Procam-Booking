import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
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

  const [{ data: assets }, { data: locationRows }, { data: travelTimeRows }, { data: workerRows }] = await Promise.all([
    supabase.from("rental_assets").select("id,human_id,is_hot_spare,partner_id,status").eq("product_id", productId),
    supabase.from("partners").select("id").eq("pickup_method", "LOCKER").eq("status", "ACTIVE"),
    supabase.from("location_travel_times").select("from_partner_id,to_partner_id,minutes"),
    supabase.from("workers").select("id,current_partner_id,active"),
  ]);

  const assetIds = (assets ?? []).map((a) => a.id);
  const { data: bookingRows } = assetIds.length
    ? await supabase
        .from("bookings")
        .select("id,asset_id,partner_id,dropoff_partner_id,status,start_time,end_time")
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

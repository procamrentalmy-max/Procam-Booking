import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { RETURN_BUFFER_MINUTES, type BookingWindow, type DroneCandidate } from "./slots";

export type ShopFleetSnapshot = {
  drones: DroneCandidate[];
  bookings: BookingWindow[];
};

/**
 * Builds the drone-fleet snapshot findNextAvailableSlot/findEligibleDrone
 * need, scoped to one shop — a booking request always targets one shop
 * (drones don't move between shops the way ProCam's locker assets do, so
 * there's no fleet-wide/cross-shop search here). Bounded to bookings whose
 * end_time is still within (or after) the return-buffer window, mirroring
 * lib/booking/lockerSnapshot.ts's own bound — nothing older can still affect
 * an overlap or the buffer check.
 */
export async function buildShopFleetSnapshot(shopId: string): Promise<ShopFleetSnapshot> {
  const supabase = createServiceRoleClient();

  const { data: drones } = await supabase.from("dr_drones").select("id,human_id,status").eq("shop_id", shopId);
  const droneIds = (drones ?? []).map((d) => d.id);

  const snapshotCutoff = new Date(Date.now() - RETURN_BUFFER_MINUTES * 60_000).toISOString();
  const { data: bookingRows } = droneIds.length
    ? await supabase
        .from("dr_bookings")
        .select("drone_id,status,start_time,end_time")
        .in("drone_id", droneIds)
        .not("status", "in", "(CANCELLED,EXPIRED)")
        .gte("end_time", snapshotCutoff)
    : { data: [] };

  return {
    drones: (drones ?? []).map((d) => ({ id: d.id, humanId: d.human_id, status: d.status })),
    bookings: (bookingRows ?? []).map((b) => ({
      droneId: b.drone_id,
      status: b.status,
      startTime: new Date(b.start_time),
      endTime: new Date(b.end_time),
    })),
  };
}

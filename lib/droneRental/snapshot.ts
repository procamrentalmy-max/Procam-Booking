import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { RETURN_BUFFER_MINUTES, type BookingWindow, type ControllerPool, type DroneCandidate } from "./slots";
import type { ControllerKind, DroneModel } from "./pricingRules";

export type ShopFleetSnapshot = {
  drones: DroneCandidate[];
  bookings: BookingWindow[];
  /** The shop's controllers of the kind asked for and what they are booked for; null when no controller is needed (phone only). */
  controllers: ControllerPool | null;
};

/**
 * A booking that hasn't been paid for yet holds nothing (see claimSlot.ts), so it isn't counted: only paid bookings, which are
 * CONFIRMED, ACTIVE or finished, take a drone or a controller out of what's free.
 *
 * Builds the drone-fleet snapshot findNextAvailableSlot/findEligibleDrone
 * need, scoped to one shop — a booking request always targets one shop
 * (drones don't move between shops the way ProCam's locker assets do, so
 * there's no fleet-wide/cross-shop search here). Bounded to bookings whose
 * end_time is still within (or after) the return-buffer window, mirroring
 * lib/booking/lockerSnapshot.ts's own bound — nothing older can still affect
 * an overlap or the buffer check.
 */
export async function buildShopFleetSnapshot(shopId: string, model?: DroneModel, controller: ControllerKind = "NONE"): Promise<ShopFleetSnapshot> {
  const supabase = createServiceRoleClient();

  // With a model, only that model's drones count: a customer who wants a GT50 is never offered a slot that only a Neo 2 is free for.
  const query = supabase.from("dr_drones").select("id,human_id,status").eq("shop_id", shopId);
  const { data: drones } = await (model ? query.eq("model_key", model) : query);
  const droneIds = (drones ?? []).map((d) => d.id);

  const snapshotCutoff = new Date(Date.now() - RETURN_BUFFER_MINUTES * 60_000).toISOString();
  const { data: bookingRows } = droneIds.length
    ? await supabase
        .from("dr_bookings")
        .select("drone_id,status,start_time,end_time")
        .in("drone_id", droneIds)
        .not("status", "in", "(PENDING_PAYMENT,CANCELLED,EXPIRED)")
        .gte("end_time", snapshotCutoff)
    : { data: [] };

  // A rental with a controller also needs one of that kind free: they're set aside per booking, like drones.
  let controllers: ControllerPool | null = null;
  if (controller !== "NONE") {
    const { data: controllerRows } = await supabase.from("dr_controllers").select("id,human_id").eq("shop_id", shopId).eq("kind", controller);
    const controllerIds = (controllerRows ?? []).map((c) => c.id);
    const { data: controllerBookings } = controllerIds.length
      ? await supabase
          .from("dr_bookings")
          .select("controller_id,status,start_time,end_time")
          .in("controller_id", controllerIds)
          .not("status", "in", "(PENDING_PAYMENT,CANCELLED,EXPIRED)")
          .gte("end_time", snapshotCutoff)
      : { data: [] };
    controllers = {
      candidates: (controllerRows ?? []).map((c) => ({ id: c.id, humanId: c.human_id, status: "AVAILABLE" as const })),
      bookings: (controllerBookings ?? []).flatMap((b) =>
        b.controller_id ? [{ droneId: b.controller_id, status: b.status, startTime: new Date(b.start_time), endTime: new Date(b.end_time) }] : []
      ),
    };
  }

  return {
    controllers,
    drones: (drones ?? []).map((d) => ({ id: d.id, humanId: d.human_id, status: d.status })),
    bookings: (bookingRows ?? []).map((b) => ({
      droneId: b.drone_id,
      status: b.status,
      startTime: new Date(b.start_time),
      endTime: new Date(b.end_time),
    })),
  };
}

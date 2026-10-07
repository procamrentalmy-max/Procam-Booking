import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { buildShopFleetSnapshot } from "./snapshot";
import { findEligibleDrone } from "./slots";
import { isDroneModel, storedController, DEFAULT_DRONE_MODEL } from "./pricingRules";

/**
 * An unpaid booking holds nothing. The slot (a drone, and a controller if one was asked for) goes to whoever PAYS first: when a
 * payment goes through, this claims a free drone and controller for the booking and moves it to CONFIRMED, which is the moment
 * it reaches the merchant. If two people paid for the last drone at the same time, the database's overlap rules let exactly one
 * claim through and the other gets `claimed: false`.
 *
 * The drone and controller chosen when the booking was made are only a first pick: if another drone of the same model is free
 * when the payment lands, the booking gets that one instead of failing.
 */
export type ClaimResult = { claimed: true } | { claimed: false };

type BookingSlot = {
  id: string;
  status: string;
  source: string;
  shop_id: string;
  drone_id: string;
  controller_id: string | null;
  drone_model: string;
  controller_kind: string;
  start_time: string;
  end_time: string;
};

async function loadSlot(bookingId: string): Promise<BookingSlot> {
  const { data } = await createServiceRoleClient()
    .from("dr_bookings")
    .select("id,status,source,shop_id,drone_id,controller_id,drone_model,controller_kind,start_time,end_time")
    .eq("id", bookingId)
    .single();
  if (!data) throw new Error("Booking not found.");
  return data;
}

/** The drone and controller that are free for this booking's time right now (its own first), or null if either is missing. */
async function freeResources(b: BookingSlot): Promise<{ droneId: string; controllerId: string | null } | null> {
  const model = isDroneModel(b.drone_model) ? b.drone_model : DEFAULT_DRONE_MODEL;
  const controller = storedController(model, b.controller_kind);
  const snapshot = await buildShopFleetSnapshot(b.shop_id, model, controller);
  const start = new Date(b.start_time);
  const end = new Date(b.end_time);

  const droneId =
    findEligibleDrone(snapshot.drones.filter((d) => d.id === b.drone_id), snapshot.bookings, start, end) ?? findEligibleDrone(snapshot.drones, snapshot.bookings, start, end);
  if (!droneId) return null;
  if (!snapshot.controllers) return { droneId, controllerId: null };

  const controllerId =
    findEligibleDrone(snapshot.controllers.candidates.filter((c) => c.id === b.controller_id), snapshot.controllers.bookings, start, end) ??
    findEligibleDrone(snapshot.controllers.candidates, snapshot.controllers.bookings, start, end);
  return controllerId ? { droneId, controllerId } : null;
}

/** Whether a drone (and controller) is still free for this unpaid booking's time. Claims nothing: used just before taking a payment. */
export async function isSlotStillFree(bookingId: string): Promise<boolean> {
  const b = await loadSlot(bookingId);
  if (b.status === "CONFIRMED" || b.status === "ACTIVE") return true;
  if (b.status !== "PENDING_PAYMENT") return false;
  // A walk-in's drone was picked by the merchant a moment ago for right now; only the overlap rules can say it was taken.
  if (b.source === "MERCHANT_INSTANT") return true;
  return (await freeResources(b)) !== null;
}

/** Claims the slot for a booking whose payment has just gone through (see the note at the top), confirming it. Safe to run twice. */
export async function claimBookingSlot(bookingId: string): Promise<ClaimResult> {
  const supabase = createServiceRoleClient();

  for (let attempt = 0; attempt < 5; attempt++) {
    const b = await loadSlot(bookingId);
    if (b.status === "CONFIRMED" || b.status === "ACTIVE") return { claimed: true };
    if (b.status !== "PENDING_PAYMENT") return { claimed: false };

    // A walk-in keeps the drone the merchant gave it; for an online booking, find whatever is free now.
    const picked = b.source === "MERCHANT_INSTANT" ? { droneId: b.drone_id, controllerId: b.controller_id } : await freeResources(b);
    if (!picked) return { claimed: false };

    const { data: updated, error } = await supabase
      .from("dr_bookings")
      .update({ status: "CONFIRMED", drone_id: picked.droneId, controller_id: picked.controllerId })
      .eq("id", bookingId)
      .eq("status", "PENDING_PAYMENT")
      .select("id");
    // 23P01 = the overlap rules refused it: someone else claimed that drone or controller between our look and our write.
    if (error?.code === "23P01") {
      if (b.source === "MERCHANT_INSTANT") return { claimed: false };
      continue;
    }
    if (error) throw new Error(error.message);
    if (updated && updated.length > 0) return { claimed: true };
    // Nothing updated: the status changed under us (a repeat delivery, say). Look again.
  }
  return { claimed: false };
}

/** The booking lost the slot: it is closed, so it never reaches the merchant and its page tells the customer to pick another time. */
export async function cancelLostBooking(bookingId: string): Promise<void> {
  await createServiceRoleClient().from("dr_bookings").update({ status: "CANCELLED" }).eq("id", bookingId).eq("status", "PENDING_PAYMENT");
}

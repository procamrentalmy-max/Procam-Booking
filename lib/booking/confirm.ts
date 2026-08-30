import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { assertValidBookingTransition, isImminent } from "@/lib/state-machine/booking";
import { logAudit } from "@/lib/audit";
import type { BookingStatus, CameraStatus } from "@/lib/db/types";

/**
 * Called once both the rental fee has succeeded and the deposit hold is in
 * place. Always lands at CONFIRMED — that's now a real, meaningfully
 * persisted status ("paid, scheduled") rather than a pass-through, because
 * bookings can be scheduled well ahead of their actual pickup time. Only
 * promotes further to READY_FOR_PICKUP right away if the scheduled start is
 * imminent; otherwise the housekeeping cron (app/api/cron/housekeeping)
 * promotes it as the time actually approaches.
 */
export async function confirmBookingAfterPayment(bookingId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("status,camera_id,start_time")
    .eq("id", bookingId)
    .single();
  if (!booking) throw new Error(`Booking ${bookingId} not found`);

  if (booking.status !== "PENDING_PAYMENT") return; // already confirmed — webhook retry

  assertValidBookingTransition(booking.status as BookingStatus, "CONFIRMED");

  const { error } = await supabase.from("bookings").update({ status: "CONFIRMED" }).eq("id", bookingId);
  if (error) throw new Error(error.message);

  await logAudit({
    actorType: "SYSTEM",
    action: "BOOKING_CONFIRMED",
    entityType: "booking",
    entityId: bookingId,
    before: { status: "PENDING_PAYMENT" },
    after: { status: "CONFIRMED" },
  });

  if (isImminent(new Date(booking.start_time))) {
    await promoteBookingToReadyForPickup(bookingId);
  }
}

/**
 * Moves a CONFIRMED booking's camera the rest of the way to
 * READY_FOR_PICKUP, catching it up through RESERVED first if it hasn't
 * been touched yet (e.g. it wasn't imminent at booking-creation time, but
 * is by the time payment/housekeeping gets to it). A camera stuck in some
 * other status (still RENTED from an overrunning prior booking) means a
 * real scheduling conflict — this surfaces that as an error rather than
 * silently pretending the camera is ready.
 */
export async function promoteBookingToReadyForPickup(bookingId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("status,camera_id")
    .eq("id", bookingId)
    .single();
  if (!booking || booking.status !== "CONFIRMED") return;

  const { data: camera } = await supabase.from("cameras").select("status").eq("id", booking.camera_id).single();
  if (!camera) throw new Error(`Camera ${booking.camera_id} not found`);

  if ((camera.status as CameraStatus) === "AVAILABLE") {
    const { error } = await supabase.rpc("system_transition_camera_status", {
      p_camera_id: booking.camera_id,
      p_to_status: "RESERVED",
      p_actor_type: "SYSTEM",
      p_booking_id: bookingId,
      p_event_type: "PAYMENT_CONFIRMED",
    });
    if (error) throw new Error(error.message);
  }

  if ((camera.status as CameraStatus) !== "READY_FOR_PICKUP") {
    const { error: cameraError } = await supabase.rpc("system_transition_camera_status", {
      p_camera_id: booking.camera_id,
      p_to_status: "READY_FOR_PICKUP",
      p_actor_type: "SYSTEM",
      p_booking_id: bookingId,
      p_event_type: "PAYMENT_CONFIRMED",
    });
    if (cameraError) throw new Error(cameraError.message);
  }

  assertValidBookingTransition("CONFIRMED", "READY_FOR_PICKUP");
  const { error: bookingError } = await supabase
    .from("bookings")
    .update({ status: "READY_FOR_PICKUP" })
    .eq("id", bookingId);
  if (bookingError) throw new Error(bookingError.message);

  await logAudit({
    actorType: "SYSTEM",
    action: "BOOKING_READY_FOR_PICKUP",
    entityType: "booking",
    entityId: bookingId,
    before: { status: "CONFIRMED" },
    after: { status: "READY_FOR_PICKUP" },
  });
}

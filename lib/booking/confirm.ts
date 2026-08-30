import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { assertValidBookingTransition } from "@/lib/state-machine/booking";
import { logAudit } from "@/lib/audit";
import type { BookingStatus } from "@/lib/db/types";

/**
 * Called once both the rental fee has succeeded and the deposit hold is in
 * place. Moves the booking through CONFIRMED -> READY_FOR_PICKUP — both, not
 * just CONFIRMED, since for V1's immediate-start bookings there's no real
 * gap between "paid" and "camera ready" and the booking state machine
 * doesn't allow CONFIRMED -> ACTIVE directly (see lib/state-machine/booking.ts).
 */
export async function confirmBookingAfterPayment(bookingId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("bookings").select("status,camera_id").eq("id", bookingId).single();
  if (!booking) throw new Error(`Booking ${bookingId} not found`);

  if (booking.status !== "PENDING_PAYMENT") return; // already confirmed — webhook retry

  assertValidBookingTransition(booking.status as BookingStatus, "CONFIRMED");
  assertValidBookingTransition("CONFIRMED", "READY_FOR_PICKUP");

  const { error } = await supabase.from("bookings").update({ status: "READY_FOR_PICKUP" }).eq("id", bookingId);
  if (error) throw new Error(error.message);

  await logAudit({
    actorType: "SYSTEM",
    action: "BOOKING_CONFIRMED",
    entityType: "booking",
    entityId: bookingId,
    before: { status: booking.status },
    after: { status: "READY_FOR_PICKUP" },
  });

  const { error: cameraError } = await supabase.rpc("system_transition_camera_status", {
    p_camera_id: booking.camera_id,
    p_to_status: "READY_FOR_PICKUP",
    p_actor_type: "SYSTEM",
    p_booking_id: bookingId,
    p_event_type: "PAYMENT_CONFIRMED",
  });
  if (cameraError) throw new Error(cameraError.message);
}

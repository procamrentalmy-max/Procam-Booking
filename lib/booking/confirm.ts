import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { assertValidBookingTransition } from "@/lib/state-machine/booking";
import type { BookingStatus } from "@/lib/db/types";

/** Called once both the rental fee has succeeded and the deposit hold is in place. */
export async function confirmBookingAfterPayment(bookingId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: booking } = await supabase.from("bookings").select("status,camera_id").eq("id", bookingId).single();
  if (!booking) throw new Error(`Booking ${bookingId} not found`);

  if (booking.status !== "PENDING_PAYMENT") return; // already confirmed — webhook retry

  assertValidBookingTransition(booking.status as BookingStatus, "CONFIRMED");

  const { error } = await supabase.from("bookings").update({ status: "CONFIRMED" }).eq("id", bookingId);
  if (error) throw new Error(error.message);

  const { error: cameraError } = await supabase.rpc("system_transition_camera_status", {
    p_camera_id: booking.camera_id,
    p_to_status: "READY_FOR_PICKUP",
    p_actor_type: "SYSTEM",
    p_booking_id: bookingId,
    p_event_type: "PAYMENT_CONFIRMED",
  });
  if (cameraError) throw new Error(cameraError.message);
}

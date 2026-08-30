"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getAuthContext, isReception } from "@/lib/auth/session";
import { assertValidBookingTransition } from "@/lib/state-machine/booking";
import { logAudit } from "@/lib/audit";
import type { BookingStatus } from "@/lib/db/types";

export type ReturnLookupResult =
  | { valid: false }
  | { valid: true; bookingId: string; customerName: string; cameraHumanId: string; kitHumanId: string };

export async function lookupBookingForReturnAction(humanId: string): Promise<ReturnLookupResult> {
  const ctx = await getAuthContext();
  if (!isReception(ctx)) throw new Error("Not authorized.");

  // RLS (reception_read_own_bookings) scopes this to the caller's own
  // property — a booking at another partner just won't come back.
  const supabase = await createServerSupabaseClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id,status,customer_id,camera_id,kit_id")
    .eq("human_id", humanId.trim().toUpperCase())
    .maybeSingle();

  if (!booking || booking.status !== "RETURN_STARTED") return { valid: false };

  const [{ data: customer }, { data: camera }, { data: kit }] = await Promise.all([
    supabase.from("customers").select("name").eq("id", booking.customer_id).single(),
    supabase.from("cameras").select("human_id").eq("id", booking.camera_id).single(),
    supabase.from("kits").select("human_id").eq("id", booking.kit_id).single(),
  ]);

  return {
    valid: true,
    bookingId: booking.id,
    customerName: customer?.name ?? "Unknown",
    cameraHumanId: camera?.human_id ?? "—",
    kitHumanId: kit?.human_id ?? "—",
  };
}

/**
 * The only place a camera moves RENTED -> RETURNED_AWAITING_INSPECTION.
 * Deposit stays held regardless — reception can't release it, and nothing
 * here touches deposit_authorizations.
 */
export async function markReturnReceivedAction(bookingId: string): Promise<void> {
  const ctx = await getAuthContext();
  if (!isReception(ctx)) throw new Error("Not authorized.");

  // Verify ownership via the RLS-scoped client BEFORE using the service
  // role for the actual write — service role bypasses RLS entirely, so
  // this read is the only thing standing between reception and writing to
  // another property's booking.
  const rlsClient = await createServerSupabaseClient();
  const { data: booking } = await rlsClient
    .from("bookings")
    .select("id,status,camera_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) throw new Error("Booking not found.");
  if (booking.status !== "RETURN_STARTED") throw new Error("This booking isn't awaiting return.");

  assertValidBookingTransition(booking.status as BookingStatus, "AWAITING_INSPECTION");

  const supabase = createServiceRoleClient();

  const { error } = await supabase.from("bookings").update({ status: "AWAITING_INSPECTION" }).eq("id", bookingId);
  if (error) throw new Error(error.message);

  await logAudit({
    actorType: "RECEPTION",
    actorId: ctx.partnerUserId,
    action: "RETURN_RECEIVED",
    entityType: "booking",
    entityId: bookingId,
    before: { status: "RETURN_STARTED" },
    after: { status: "AWAITING_INSPECTION" },
  });

  const { error: cameraError } = await supabase.rpc("system_transition_camera_status", {
    p_camera_id: booking.camera_id,
    p_to_status: "RETURNED_AWAITING_INSPECTION",
    p_actor_type: "RECEPTION",
    p_actor_id: ctx.partnerUserId,
    p_booking_id: bookingId,
    p_event_type: "RECEIVED_BY_RECEPTION",
  });
  if (cameraError) throw new Error(cameraError.message);
}

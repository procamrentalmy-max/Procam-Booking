"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assertValidBookingTransition } from "@/lib/state-machine/booking";
import { logAudit } from "@/lib/audit";
import type { BookingStatus } from "@/lib/db/types";

/**
 * Bypasses Stripe entirely and confirms a booking directly — for local/dev
 * testing when there's no public HTTPS endpoint for Stripe to reach (the
 * webhook needs one; see app/api/webhooks/stripe/route.ts and the Stripe
 * CLI's `stripe listen --forward-to` for local forwarding instead of this).
 * Real bookings should always be confirmed by the webhook, not this.
 *
 * Uses the RLS-scoped client deliberately, not the service role: the
 * admin_all_bookings / staff-gated transition_asset_status RPC policies
 * are what actually stop a non-admin from calling this — there's no
 * separate role check in this function itself.
 */
export async function forceConfirmBookingAction(formData: FormData) {
  const id = z.string().uuid().parse(formData.get("id"));
  const supabase = await createServerSupabaseClient();

  const { data: booking } = await supabase.from("bookings").select("status,asset_id").eq("id", id).single();
  if (!booking) throw new Error("Booking not found.");

  // Same two-step as lib/booking/confirm.ts — the state machine doesn't
  // allow CONFIRMED -> ACTIVE directly, only via READY_FOR_PICKUP.
  assertValidBookingTransition(booking.status as BookingStatus, "CONFIRMED");
  assertValidBookingTransition("CONFIRMED", "READY_FOR_PICKUP");

  const { error } = await supabase.from("bookings").update({ status: "READY_FOR_PICKUP" }).eq("id", id);
  if (error) throw new Error(error.message);

  await logAudit({
    actorType: "ADMIN",
    action: "BOOKING_FORCE_CONFIRMED",
    entityType: "booking",
    entityId: id,
    before: { status: booking.status },
    after: { status: "READY_FOR_PICKUP" },
  });

  const { error: assetError } = await supabase.rpc("transition_asset_status", {
    p_asset_id: booking.asset_id,
    p_to_status: "READY_FOR_PICKUP",
    p_booking_id: id,
    p_event_type: "ADMIN_TEST_CONFIRM",
  });
  if (assetError) throw new Error(assetError.message);

  revalidatePath("/admin/bookings");
}

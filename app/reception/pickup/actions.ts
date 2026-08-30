"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthContext, isReception } from "@/lib/auth/session";

const PICKUP_READY_STATUSES = ["CONFIRMED", "READY_FOR_PICKUP"];

export type PickupLookupResult =
  | { valid: false }
  | { valid: true; bookingId: string; customerName: string; assetHumanId: string; kitHumanId: string };

/**
 * Looks up a booking by its human-readable code. RLS (reception_read_own_*
 * policies) is what actually scopes this to the reception user's own
 * property — there's no manual partnerId filter here because none is
 * needed, a cross-property booking simply won't come back.
 */
export async function lookupBookingForPickupAction(humanId: string): Promise<PickupLookupResult> {
  const ctx = await getAuthContext();
  if (!isReception(ctx)) throw new Error("Not authorized.");

  const supabase = await createServerSupabaseClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id,status,customer_id,asset_id,kit_id")
    .eq("human_id", humanId.trim().toUpperCase())
    .maybeSingle();

  if (!booking || !PICKUP_READY_STATUSES.includes(booking.status)) {
    return { valid: false };
  }

  const [{ data: customer }, { data: asset }, { data: kit }] = await Promise.all([
    supabase.from("customers").select("name").eq("id", booking.customer_id).single(),
    supabase.from("rental_assets").select("human_id").eq("id", booking.asset_id).single(),
    supabase.from("kits").select("human_id").eq("id", booking.kit_id).single(),
  ]);

  return {
    valid: true,
    bookingId: booking.id,
    customerName: customer?.name ?? "Unknown",
    assetHumanId: asset?.human_id ?? "—",
    kitHumanId: kit?.human_id ?? "—",
  };
}

/**
 * Purely a log entry (spec section 1: reception "may" mark this — it's
 * optional and never gates the customer's own pre-rental check). Asset
 * status doesn't change here.
 */
export async function markHandedOverAction(bookingId: string): Promise<void> {
  const ctx = await getAuthContext();
  if (!isReception(ctx)) throw new Error("Not authorized.");

  const supabase = await createServerSupabaseClient();

  const { data: booking } = await supabase.from("bookings").select("asset_id").eq("id", bookingId).single();
  if (!booking) throw new Error("Booking not found.");

  const { error } = await supabase.from("asset_events").insert({
    asset_type: "RENTAL_ASSET",
    asset_id: booking.asset_id,
    booking_id: bookingId,
    event_type: "CUSTOMER_PICKUP",
    to_status: "READY_FOR_PICKUP",
    actor_type: "RECEPTION",
    actor_id: ctx.partnerUserId,
  });
  if (error) throw new Error(error.message);
}

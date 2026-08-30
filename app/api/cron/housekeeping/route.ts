import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { promoteBookingToReadyForPickup } from "@/lib/booking/confirm";
import { PENDING_PAYMENT_TIMEOUT_MINUTES } from "@/lib/state-machine/booking";
import { logAudit } from "@/lib/audit";

/**
 * Two time-driven jobs that don't belong on any request path:
 *
 * 1. Expire PENDING_PAYMENT bookings older than PENDING_PAYMENT_TIMEOUT_MINUTES
 *    and free the asset they were holding — otherwise an abandoned
 *    checkout griefs a property's whole fleet indefinitely.
 * 2. Promote CONFIRMED bookings whose scheduled start_time has arrived to
 *    READY_FOR_PICKUP (see lib/booking/confirm.ts) — bookings made well
 *    ahead of time stop at CONFIRMED and don't touch their asset's status
 *    until this catches up with them.
 *
 * Schedule this with Vercel Cron (vercel.json) or any external scheduler
 * hitting this URL every few minutes with the CRON_SECRET bearer token.
 * Not run anywhere automatically in this environment — there's no
 * deployment yet for a scheduler to call.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const result = { expired: 0, promoted: 0, errors: [] as string[] };

  const staleCutoff = new Date(Date.now() - PENDING_PAYMENT_TIMEOUT_MINUTES * 60_000).toISOString();
  const { data: staleBookings } = await supabase
    .from("bookings")
    .select("id,asset_id")
    .eq("status", "PENDING_PAYMENT")
    .lt("created_at", staleCutoff);

  for (const booking of staleBookings ?? []) {
    try {
      const { error } = await supabase.from("bookings").update({ status: "EXPIRED" }).eq("id", booking.id);
      if (error) throw new Error(error.message);

      await logAudit({
        actorType: "SYSTEM",
        action: "BOOKING_EXPIRED",
        entityType: "booking",
        entityId: booking.id,
        before: { status: "PENDING_PAYMENT" },
        after: { status: "EXPIRED" },
      });

      const { data: asset } = await supabase.from("rental_assets").select("status").eq("id", booking.asset_id).single();
      if (asset?.status === "RESERVED") {
        await supabase.rpc("system_transition_asset_status", {
          p_asset_id: booking.asset_id,
          p_to_status: "AVAILABLE",
          p_actor_type: "SYSTEM",
          p_booking_id: booking.id,
          p_event_type: "BOOKING_EXPIRED",
        });
      }

      result.expired += 1;
    } catch (err) {
      result.errors.push(`expire ${booking.id}: ${(err as Error).message}`);
    }
  }

  const { data: dueBookings } = await supabase
    .from("bookings")
    .select("id")
    .eq("status", "CONFIRMED")
    .lte("start_time", new Date().toISOString());

  for (const booking of dueBookings ?? []) {
    try {
      await promoteBookingToReadyForPickup(booking.id);
      result.promoted += 1;
    } catch (err) {
      result.errors.push(`promote ${booking.id}: ${(err as Error).message}`);
    }
  }

  return NextResponse.json(result);
}

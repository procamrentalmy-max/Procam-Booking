import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { releaseDepositHold } from "./payment";

/** How far back a closed no-show is looked at again to retry a deposit release that failed (Stripe was down, say). */
const RETRY_DAYS = 6;

/**
 * Closes drone-rental bookings that nobody ever collected.
 *
 * A booking that is still CONFIRMED when its rental period ends was never handed over (a handover makes it ACTIVE), so the customer
 * simply did not show up. The rental fee stays paid; the booking is closed as COMPLETED with no pickup and no return time, and the
 * deposit hold, which was kept all through the rental period in case they turned up late, is released.
 *
 * The hold is let go in a second step that is safe to repeat, so a release that failed is retried on the next run instead of
 * leaving the customer's money reserved. Called from the shared housekeeping cron (app/api/cron/housekeeping).
 */
export async function closeUncollectedDroneBookings(): Promise<{ closed: number; released: number; errors: string[] }> {
  const supabase = createServiceRoleClient();
  const errors: string[] = [];
  const now = new Date();

  // Step 1: close what has run out. The status guard means a handover that lands at the last moment wins and is left alone.
  const { data: ended } = await supabase.from("dr_bookings").select("id").eq("status", "CONFIRMED").lt("end_time", now.toISOString());
  let closed = 0;
  for (const booking of ended ?? []) {
    const { data: updated, error } = await supabase
      .from("dr_bookings")
      .update({ status: "COMPLETED" })
      .eq("id", booking.id)
      .eq("status", "CONFIRMED")
      .is("actual_pickup_time", null)
      .select("id");
    if (error) errors.push(`close ${booking.id}: ${error.message}`);
    else if (updated?.length) closed += 1;
  }

  // Step 2: let go of the deposit hold of every uncollected booking that is closed (including ones whose release failed earlier).
  const since = new Date(now.getTime() - RETRY_DAYS * 24 * 60 * 60_000).toISOString();
  const { data: uncollected } = await supabase
    .from("dr_bookings")
    .select("id")
    .eq("status", "COMPLETED")
    .is("actual_pickup_time", null)
    .is("actual_return_time", null)
    .gte("end_time", since);
  const ids = (uncollected ?? []).map((b) => b.id);
  const { data: holds } = ids.length ? await supabase.from("dr_deposit_authorizations").select("booking_id").in("booking_id", ids).eq("status", "AUTHORIZED") : { data: [] };

  let released = 0;
  for (const hold of holds ?? []) {
    try {
      await releaseDepositHold(hold.booking_id);
      released += 1;
    } catch (err) {
      errors.push(`release ${hold.booking_id}: ${(err as Error).message}`);
    }
  }

  return { closed, released, errors };
}

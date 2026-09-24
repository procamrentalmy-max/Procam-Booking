import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { PENDING_PAYMENT_TIMEOUT_MINUTES } from "@/lib/state-machine/booking";

/**
 * Expires drone-rental bookings that have sat PENDING_PAYMENT too long —
 * an abandoned online checkout, or a walk-in whose customer never finished
 * paying on the merchant's device. No asset-status side effect needed here
 * (unlike ProCam's rental_assets/RESERVED): a drone's status only ever
 * moves to RENTED at actual pickup handover (see
 * app/merchant/pickup/[bookingId]/actions.ts), so an expired PENDING_PAYMENT
 * booking never left the drone in anything but AVAILABLE — flipping the
 * booking off PENDING_PAYMENT is enough to free its slot back up (the
 * no_overlapping_drone_bookings exclude constraint excludes EXPIRED).
 * Called from the shared housekeeping cron (app/api/cron/housekeeping).
 */
export async function expireStalePendingDroneBookings(): Promise<{ expired: number; errors: string[] }> {
  const supabase = createServiceRoleClient();
  const errors: string[] = [];

  const staleCutoff = new Date(Date.now() - PENDING_PAYMENT_TIMEOUT_MINUTES * 60_000).toISOString();
  const { data: staleBookings } = await supabase
    .from("dr_bookings")
    .select("id")
    .eq("status", "PENDING_PAYMENT")
    .lt("created_at", staleCutoff);

  let expired = 0;
  for (const booking of staleBookings ?? []) {
    const { error } = await supabase.from("dr_bookings").update({ status: "EXPIRED" }).eq("id", booking.id).eq("status", "PENDING_PAYMENT");
    if (error) {
      errors.push(`expire ${booking.id}: ${error.message}`);
      continue;
    }
    expired += 1;
  }

  return { expired, errors };
}

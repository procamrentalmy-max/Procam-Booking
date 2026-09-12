import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type FunnelEventType =
  | "LANDING_VIEWED"
  | "WIZARD_OPENED"
  | "VERIFICATION_STARTED"
  | "VERIFICATION_VERIFIED"
  | "BOOKING_CREATED"
  | "PAYMENT_CONFIRMED";

/**
 * Best-effort funnel counter — never allowed to break the customer flow
 * it's observing. No customer/device identifier is stored, only which stage
 * was reached, at which locker, when.
 */
export async function logFunnelEvent(eventType: FunnelEventType, partnerId: string | null): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("funnel_events").insert({ event_type: eventType, partner_id: partnerId });
    if (error) console.error("[funnel] failed to log event", eventType, error.message);
  } catch (err) {
    console.error("[funnel] failed to log event", eventType, err);
  }
}

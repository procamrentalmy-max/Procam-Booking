import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { ActorType } from "@/lib/db/types";

/**
 * Generic audit trail for state-changing actions that aren't physical-asset
 * transitions (those already get an asset_events row — see
 * lib/state-machine/). Booking status changes, payment/deposit resolutions,
 * and admin overrides go through here instead.
 *
 * Not yet wired into every admin CRUD action — that sweep is its own later
 * phase (plan section 7, "audit/event-log wiring pass"), not silently
 * skipped.
 */
export async function logAudit(params: {
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase.from("audit_logs").insert({
    actor_type: params.actorType,
    actor_id: params.actorId ?? null,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    before: params.before ?? null,
    after: params.after ?? null,
  });
}

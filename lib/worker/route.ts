import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { buildWorkerFleetSnapshot } from "./fleetSnapshot";
import { planRoute, type RouteStopAction } from "@/lib/locker-engine/routing";
import type { FleetSnapshot } from "@/lib/locker-engine/types";

export type EnrichedAction = {
  type: RouteStopAction["type"];
  assets: { id: string; humanId: string }[];
};

export type NextStop = {
  partnerId: string;
  partnerName: string;
  actions: EnrichedAction[];
};

export type WorkerLookupError = "NO_WORKER_ROW" | "WORKER_INACTIVE";

export type NextStopResult =
  | { error: WorkerLookupError }
  | { error: null; nextStop: NextStop | null; unmetDropoffs: { partnerId: string; shortfall: number }[] };

async function findWorker(staffId: string) {
  const supabase = createServiceRoleClient();
  return supabase.from("workers").select("id,current_partner_id,active").eq("staff_user_id", staffId).maybeSingle();
}

/**
 * Scopes a fleet snapshot to one worker: their own row only (so planRoute's
 * "the active worker" is unambiguous even with several workers active at
 * once — before this, every worker's plan silently used whichever active
 * worker happened to come first in the query), and their assigned lockers
 * only, if any are assigned. A worker with no locker_assignments rows still
 * covers every locker — see the migration comment on
 * worker_locker_assignments — so nothing changes for a fleet that's never
 * bothered to assign anyone specific lockers.
 */
function scopeSnapshotToWorker(
  snapshot: FleetSnapshot,
  worker: { id: string; current_partner_id: string | null; active: boolean },
  assignedPartnerIds: Set<string>
): FleetSnapshot {
  return {
    ...snapshot,
    locations:
      assignedPartnerIds.size > 0
        ? snapshot.locations.filter((l) => assignedPartnerIds.has(l.partnerId))
        : snapshot.locations,
    workers: [{ id: worker.id, currentPartnerId: worker.current_partner_id, active: worker.active }],
  };
}

/** The worker's next stop, freshly computed against live data every time — never a stale precomputed multi-stop plan. */
export async function getNextStopForStaff(staffId: string): Promise<NextStopResult> {
  const { data: worker } = await findWorker(staffId);
  if (!worker) return { error: "NO_WORKER_ROW" };
  if (!worker.active) return { error: "WORKER_INACTIVE" };

  const supabase = createServiceRoleClient();
  const [snapshot, { data: assignments }] = await Promise.all([
    buildWorkerFleetSnapshot(),
    supabase.from("worker_locker_assignments").select("partner_id").eq("worker_id", worker.id),
  ]);
  const scopedSnapshot = scopeSnapshotToWorker(snapshot, worker, new Set((assignments ?? []).map((a) => a.partner_id)));

  const plan = planRoute(scopedSnapshot, new Date());

  if (plan.stops.length === 0) {
    return { error: null, nextStop: null, unmetDropoffs: plan.unmetDropoffs };
  }

  const stop = plan.stops[0];
  const assetIds = [...new Set(stop.actions.flatMap((a) => a.assetIds))];
  const [{ data: partner }, { data: assetRows }] = await Promise.all([
    supabase.from("partners").select("name").eq("id", stop.partnerId).single(),
    assetIds.length
      ? supabase.from("rental_assets").select("id,human_id").in("id", assetIds)
      : Promise.resolve({ data: [] as { id: string; human_id: string }[] }),
  ]);
  const humanIdById = new Map((assetRows ?? []).map((a) => [a.id, a.human_id]));

  return {
    error: null,
    nextStop: {
      partnerId: stop.partnerId,
      partnerName: partner?.name ?? "Unknown",
      actions: stop.actions.map((a) => ({
        type: a.type,
        assets: a.assetIds.map((id) => ({ id, humanId: humanIdById.get(id) ?? id })),
      })),
    },
    unmetDropoffs: plan.unmetDropoffs,
  };
}

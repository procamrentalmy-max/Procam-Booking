import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { buildWorkerFleetSnapshot } from "./fleetSnapshot";
import { planRoute, type RouteStopAction } from "@/lib/locker-engine/routing";

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
  return supabase.from("workers").select("id,active").eq("staff_user_id", staffId).maybeSingle();
}

/** The worker's next stop, freshly computed against live data every time — never a stale precomputed multi-stop plan. */
export async function getNextStopForStaff(staffId: string): Promise<NextStopResult> {
  const { data: worker } = await findWorker(staffId);
  if (!worker) return { error: "NO_WORKER_ROW" };
  if (!worker.active) return { error: "WORKER_INACTIVE" };

  const supabase = createServiceRoleClient();
  const snapshot = await buildWorkerFleetSnapshot();
  const plan = planRoute(snapshot, new Date());

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

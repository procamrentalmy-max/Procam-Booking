import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { buildWorkerFleetSnapshot } from "./fleetSnapshot";
import { planRoute, type RouteStopAction } from "@/lib/locker-engine/routing";
import { chooseStop, type PhotoDelivery } from "@/lib/locker-engine/photoDelivery";
import type { FleetSnapshot } from "@/lib/locker-engine/types";

export type EnrichedAction = {
  type: RouteStopAction["type"];
  assets: { id: string; humanId: string }[];
};

export type { PhotoDelivery };

export type NextStop = {
  partnerId: string;
  partnerName: string;
  actions: EnrichedAction[];
  photoOrders: PhotoDelivery[];
};

export type WorkerLookupError = "NO_WORKER_ROW" | "WORKER_INACTIVE";

export type NextStopResult =
  | { error: WorkerLookupError }
  | {
      error: null;
      nextStop: NextStop | null;
      unmetDropoffs: { partnerId: string; shortfall: number }[];
      otherPendingPhotoDeliveries: { partnerId: string; partnerName: string; count: number }[];
      currentPartnerId: string | null;
    };

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

/**
 * Printed photo orders (status PRINTING, see app/staff/photo-orders) waiting
 * to be handed to a hotel, grouped by partner. Same "empty set covers
 * everything" convention as locker assignments: a worker with no assigned
 * lockers sees every hotel's pending deliveries, not none.
 */
async function fetchPendingPhotoDeliveries(assignedPartnerIds: Set<string>): Promise<Map<string, PhotoDelivery[]>> {
  const supabase = createServiceRoleClient();
  let query = supabase
    .from("photo_orders")
    .select("id,partner_id,customer_name,size,quantity,slot_number")
    .eq("status", "PRINTING");
  if (assignedPartnerIds.size > 0) query = query.in("partner_id", [...assignedPartnerIds]);
  const { data } = await query;

  const byPartner = new Map<string, PhotoDelivery[]>();
  for (const row of data ?? []) {
    const list = byPartner.get(row.partner_id) ?? [];
    list.push({
      id: row.id,
      customerName: row.customer_name,
      size: row.size,
      quantity: row.quantity,
      slotNumber: row.slot_number,
    });
    byPartner.set(row.partner_id, list);
  }
  return byPartner;
}

async function partnerName(partnerId: string): Promise<string> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("partners").select("name").eq("id", partnerId).single();
  return data?.name ?? "Unknown";
}

/**
 * The worker's next stop, freshly computed against live data every time —
 * never a stale precomputed multi-stop plan. Camera relocation still comes
 * entirely from planRoute (untouched); photo deliveries are layered on top
 * via chooseStop() above, either riding along with a stop the camera
 * engine already picked or, once no camera urgency remains, competing with
 * plain camera returns for which is actually nearest.
 */
export async function getNextStopForStaff(staffId: string): Promise<NextStopResult> {
  const { data: worker } = await findWorker(staffId);
  if (!worker) return { error: "NO_WORKER_ROW" };
  if (!worker.active) return { error: "WORKER_INACTIVE" };

  const supabase = createServiceRoleClient();
  const [snapshot, { data: assignments }] = await Promise.all([
    buildWorkerFleetSnapshot(),
    supabase.from("worker_locker_assignments").select("partner_id").eq("worker_id", worker.id),
  ]);
  const assignedPartnerIds = new Set((assignments ?? []).map((a) => a.partner_id));
  const scopedSnapshot = scopeSnapshotToWorker(snapshot, worker, assignedPartnerIds);

  const [plan, photoDeliveriesByPartner] = await Promise.all([
    Promise.resolve(planRoute(scopedSnapshot, new Date())),
    fetchPendingPhotoDeliveries(assignedPartnerIds),
  ]);

  function otherDeliveries(excludePartnerId: string | null): { partnerId: string; partnerName: string; count: number }[] {
    return [...photoDeliveriesByPartner.entries()]
      .filter(([partnerId]) => partnerId !== excludePartnerId)
      .map(([partnerId, orders]) => ({ partnerId, partnerName: "", count: orders.length }));
  }

  const decision = chooseStop(scopedSnapshot, worker.current_partner_id, plan.stops[0] ?? null, photoDeliveriesByPartner);

  if (!decision) {
    return {
      error: null,
      nextStop: null,
      unmetDropoffs: plan.unmetDropoffs,
      otherPendingPhotoDeliveries: [],
      currentPartnerId: worker.current_partner_id,
    };
  }

  const stop = decision.fromPlan ? plan.stops[0] : null;
  const assetIds = stop ? [...new Set(stop.actions.flatMap((a) => a.assetIds))] : [];
  const [{ data: partner }, { data: assetRows }] = await Promise.all([
    supabase.from("partners").select("name").eq("id", decision.partnerId).single(),
    assetIds.length
      ? supabase.from("rental_assets").select("id,human_id").in("id", assetIds)
      : Promise.resolve({ data: [] as { id: string; human_id: string }[] }),
  ]);
  const humanIdById = new Map((assetRows ?? []).map((a) => [a.id, a.human_id]));

  const others = await Promise.all(
    otherDeliveries(decision.partnerId).map(async (d) => ({ ...d, partnerName: await partnerName(d.partnerId) }))
  );

  return {
    error: null,
    nextStop: {
      partnerId: decision.partnerId,
      partnerName: partner?.name ?? "Unknown",
      actions: stop
        ? stop.actions.map((a) => ({ type: a.type, assets: a.assetIds.map((id) => ({ id, humanId: humanIdById.get(id) ?? id })) }))
        : [],
      photoOrders: photoDeliveriesByPartner.get(decision.partnerId) ?? [],
    },
    unmetDropoffs: plan.unmetDropoffs,
    otherPendingPhotoDeliveries: others,
    currentPartnerId: worker.current_partner_id,
  };
}

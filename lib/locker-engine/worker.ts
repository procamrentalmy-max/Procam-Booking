import type { FleetSnapshot } from "./types";

export class WorkerNotFoundError extends Error {
  constructor(workerId: string) {
    super(`Worker ${workerId} not found in snapshot`);
    this.name = "WorkerNotFoundError";
  }
}

export class WorkerInactiveError extends Error {
  constructor(workerId: string) {
    super(`Worker ${workerId} is not active`);
    this.name = "WorkerInactiveError";
  }
}

/** Updates the worker's current position — called when a route stop completes. */
export function moveWorkerToPartner(snapshot: FleetSnapshot, workerId: string, partnerId: string): FleetSnapshot {
  const worker = snapshot.workers.find((w) => w.id === workerId);
  if (!worker) throw new WorkerNotFoundError(workerId);
  if (!worker.active) throw new WorkerInactiveError(workerId);
  return {
    ...snapshot,
    workers: snapshot.workers.map((w) => (w.id === workerId ? { ...w, currentPartnerId: partnerId } : w)),
  };
}

import { describe, expect, it } from "vitest";
import { moveWorkerToPartner } from "./worker";
import type { FleetSnapshot } from "./types";

function baseSnapshot(): FleetSnapshot {
  return {
    assets: [],
    bookings: [],
    compartments: [],
    workers: [{ id: "worker-1", currentPartnerId: "loc-a", active: true }],
  };
}

describe("moveWorkerToPartner", () => {
  it("updates the worker's current location", () => {
    const snapshot = moveWorkerToPartner(baseSnapshot(), "worker-1", "loc-b");
    expect(snapshot.workers[0].currentPartnerId).toBe("loc-b");
  });

  it("throws for an unknown worker", () => {
    expect(() => moveWorkerToPartner(baseSnapshot(), "worker-9", "loc-b")).toThrow(/not found/);
  });

  it("throws moving an inactive worker", () => {
    const snapshot = baseSnapshot();
    snapshot.workers[0].active = false;
    expect(() => moveWorkerToPartner(snapshot, "worker-1", "loc-b")).toThrow(/not active/);
  });
});

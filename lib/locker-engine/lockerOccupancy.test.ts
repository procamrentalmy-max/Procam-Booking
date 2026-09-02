import { describe, expect, it } from "vitest";
import { assignAssetToCompartment, releaseCompartment } from "./lockerOccupancy";
import type { FleetSnapshot } from "./types";

function baseSnapshot(): FleetSnapshot {
  return {
    assets: [],
    bookings: [],
    compartments: [
      { id: "c1", lockerId: "locker-1", compartmentNumber: 1, currentAssetId: null },
      { id: "c2", lockerId: "locker-1", compartmentNumber: 2, currentAssetId: "cam-9" },
    ],
    workers: [],
  };
}

describe("assignAssetToCompartment", () => {
  it("assigns an asset to an empty compartment", () => {
    const snapshot = assignAssetToCompartment(baseSnapshot(), "c1", "cam-1");
    expect(snapshot.compartments.find((c) => c.id === "c1")?.currentAssetId).toBe("cam-1");
  });

  it("throws assigning into an occupied compartment", () => {
    expect(() => assignAssetToCompartment(baseSnapshot(), "c2", "cam-1")).toThrow(/already occupied/);
  });

  it("throws assigning an asset that's already in another compartment", () => {
    expect(() => assignAssetToCompartment(baseSnapshot(), "c1", "cam-9")).toThrow(/already assigned/);
  });

  it("throws for an unknown compartment", () => {
    expect(() => assignAssetToCompartment(baseSnapshot(), "does-not-exist", "cam-1")).toThrow(/not found/);
  });
});

describe("releaseCompartment", () => {
  it("empties an occupied compartment", () => {
    const snapshot = releaseCompartment(baseSnapshot(), "c2");
    expect(snapshot.compartments.find((c) => c.id === "c2")?.currentAssetId).toBeNull();
  });

  it("throws releasing an already-empty compartment", () => {
    expect(() => releaseCompartment(baseSnapshot(), "c1")).toThrow(/already empty/);
  });
});

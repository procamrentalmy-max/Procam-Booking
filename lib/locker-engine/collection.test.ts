import { describe, expect, it } from "vitest";
import { collectCamerasAtPartner, selectCamerasForCollection } from "./collection";
import type { FleetSnapshot } from "./types";

const NOW = new Date("2026-09-02T10:00:00Z");
const SOON = new Date(NOW.getTime() + 30 * 60_000);
const LATER = new Date(NOW.getTime() + 4 * 60 * 60_000);
const HORIZON_MINUTES = 180;

function baseSnapshot(): FleetSnapshot {
  return {
    assets: [
      { id: "cam-1", humanId: "CAM-070", isHotSpare: false, partnerId: "loc-a", status: "AVAILABLE" },
      { id: "cam-2", humanId: "CAM-071", isHotSpare: false, partnerId: "loc-a", status: "RETURNED_AWAITING_INSPECTION" },
      { id: "cam-3", humanId: "CAM-072", isHotSpare: false, partnerId: "loc-a", status: "RENTED" },
      { id: "cam-4", humanId: "CAM-073", isHotSpare: false, partnerId: "loc-b", status: "AVAILABLE" },
    ],
    bookings: [],
    compartments: [],
    workers: [],
    locations: [],
    travelTimes: [],
  };
}

describe("selectCamerasForCollection", () => {
  it("collects an AVAILABLE camera with nothing confirmed against it soon", () => {
    expect(selectCamerasForCollection(baseSnapshot(), "loc-a", NOW)).toContain("cam-1");
  });

  it("always collects a returned camera, regardless of bookings", () => {
    expect(selectCamerasForCollection(baseSnapshot(), "loc-a", NOW)).toContain("cam-2");
  });

  it("leaves an AVAILABLE camera needed for a confirmed booking within the horizon", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [{ id: "b1", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: SOON, endTime: LATER, isOvernight: false }],
    };
    const selected = selectCamerasForCollection(snapshot, "loc-a", NOW, HORIZON_MINUTES);
    expect(selected).not.toContain("cam-1");
  });

  it("still collects a returned camera even if some future booking is attached to it", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [{ id: "b1", assetId: "cam-2", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: SOON, endTime: LATER, isOvernight: false }],
    };
    expect(selectCamerasForCollection(snapshot, "loc-a", NOW, HORIZON_MINUTES)).toContain("cam-2");
  });

  it("ignores a cancelled booking when deciding whether a camera is needed", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [{ id: "b1", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CANCELLED", startTime: SOON, endTime: LATER, isOvernight: false }],
    };
    expect(selectCamerasForCollection(snapshot, "loc-a", NOW, HORIZON_MINUTES)).toContain("cam-1");
  });

  it("does not touch a camera that isn't AVAILABLE or RETURNED (e.g. currently RENTED)", () => {
    expect(selectCamerasForCollection(baseSnapshot(), "loc-a", NOW)).not.toContain("cam-3");
  });

  it("ignores cameras positioned at a different location", () => {
    expect(selectCamerasForCollection(baseSnapshot(), "loc-a", NOW)).not.toContain("cam-4");
  });

  it("treats a booking starting exactly at the 3-hour boundary as needed soon", () => {
    const horizonEnd = new Date(NOW.getTime() + HORIZON_MINUTES * 60_000);
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [
        { id: "b1", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: horizonEnd, endTime: new Date(horizonEnd.getTime() + 60 * 60_000), isOvernight: false },
      ],
    };
    expect(selectCamerasForCollection(snapshot, "loc-a", NOW, HORIZON_MINUTES)).not.toContain("cam-1");
  });
});

describe("collectCamerasAtPartner", () => {
  it("moves collected cameras off the location (partnerId -> null) and leaves the rest untouched", () => {
    const { snapshot: result, collectedAssetIds } = collectCamerasAtPartner(baseSnapshot(), "loc-a", NOW);

    expect(collectedAssetIds.sort()).toEqual(["cam-1", "cam-2"]);
    expect(result.assets.find((a) => a.id === "cam-1")?.partnerId).toBeNull();
    expect(result.assets.find((a) => a.id === "cam-2")?.partnerId).toBeNull();
    expect(result.assets.find((a) => a.id === "cam-3")?.partnerId).toBe("loc-a"); // RENTED, untouched
    expect(result.assets.find((a) => a.id === "cam-4")?.partnerId).toBe("loc-b"); // different location
  });

  it("leaves a booked-soon camera in place", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [{ id: "b1", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: SOON, endTime: LATER, isOvernight: false }],
    };
    const { snapshot: result, collectedAssetIds } = collectCamerasAtPartner(snapshot, "loc-a", NOW, HORIZON_MINUTES);
    expect(collectedAssetIds).not.toContain("cam-1");
    expect(result.assets.find((a) => a.id === "cam-1")?.partnerId).toBe("loc-a");
  });
});

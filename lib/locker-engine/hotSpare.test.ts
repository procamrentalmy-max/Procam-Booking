import { describe, expect, it } from "vitest";
import {
  demoteHotSpare,
  handleAssetFailure,
  promoteToHotSpare,
  selectReplacementHotSpare,
} from "./hotSpare";
import type { FleetSnapshot } from "./types";

const NOW = new Date("2026-09-02T10:00:00Z");
const SOON = new Date(NOW.getTime() + 30 * 60_000);
const LATER = new Date(NOW.getTime() + 4 * 60 * 60_000);

function baseSnapshot(): FleetSnapshot {
  return {
    assets: [
      { id: "cam-1", humanId: "CAM-070", isHotSpare: false, partnerId: "loc-a", status: "AVAILABLE" },
      { id: "cam-2", humanId: "CAM-071", isHotSpare: false, partnerId: "loc-a", status: "AVAILABLE" },
      { id: "cam-3", humanId: "CAM-072", isHotSpare: false, partnerId: "loc-b", status: "AVAILABLE" },
      { id: "spare", humanId: "CAM-076", isHotSpare: true, partnerId: null, status: "AVAILABLE" },
    ],
    bookings: [],
    compartments: [],
    workers: [],
  };
}

describe("promoteToHotSpare / demoteHotSpare", () => {
  it("demotes the current hot spare", () => {
    const snapshot = demoteHotSpare(baseSnapshot(), "spare");
    expect(snapshot.assets.find((a) => a.id === "spare")?.isHotSpare).toBe(false);
  });

  it("throws demoting an asset that isn't the hot spare", () => {
    expect(() => demoteHotSpare(baseSnapshot(), "cam-1")).toThrow(/not currently the hot spare/);
  });

  it("promotes an eligible AVAILABLE camera", () => {
    const snapshot = promoteToHotSpare(demoteHotSpare(baseSnapshot(), "spare"), "cam-1", NOW);
    expect(snapshot.assets.find((a) => a.id === "cam-1")?.isHotSpare).toBe(true);
  });

  it("refuses to promote a camera with a booking inside the routing horizon", () => {
    const snapshot: FleetSnapshot = {
      ...demoteHotSpare(baseSnapshot(), "spare"),
      bookings: [{ id: "bkg-1", assetId: "cam-1", status: "CONFIRMED", startTime: SOON, endTime: LATER }],
    };
    expect(() => promoteToHotSpare(snapshot, "cam-1", NOW)).toThrow(/routing horizon/);
  });

  it("refuses to promote a non-AVAILABLE camera", () => {
    const snapshot = demoteHotSpare(baseSnapshot(), "spare");
    const rented: FleetSnapshot = {
      ...snapshot,
      assets: snapshot.assets.map((a) => (a.id === "cam-1" ? { ...a, status: "RENTED" as const } : a)),
    };
    expect(() => promoteToHotSpare(rented, "cam-1", NOW)).toThrow(/must be AVAILABLE/);
  });
});

describe("selectReplacementHotSpare", () => {
  it("picks the first eligible sellable camera by deterministic ordering", () => {
    expect(selectReplacementHotSpare(baseSnapshot(), NOW)).toBe("cam-1");
  });

  it("skips a camera needed for a confirmed booking soon", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [{ id: "bkg-1", assetId: "cam-1", status: "CONFIRMED", startTime: SOON, endTime: LATER }],
    };
    expect(selectReplacementHotSpare(snapshot, NOW)).toBe("cam-2");
  });

  it("ignores cancelled/expired/completed bookings", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [{ id: "bkg-1", assetId: "cam-1", status: "CANCELLED", startTime: SOON, endTime: LATER }],
    };
    expect(selectReplacementHotSpare(snapshot, NOW)).toBe("cam-1");
  });

  it("returns null when every candidate is booked or unavailable", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [
        { id: "b1", assetId: "cam-1", status: "CONFIRMED", startTime: NOW, endTime: SOON },
        { id: "b2", assetId: "cam-2", status: "ACTIVE", startTime: NOW, endTime: SOON },
        { id: "b3", assetId: "cam-3", status: "READY_FOR_PICKUP", startTime: NOW, endTime: SOON },
      ],
    };
    expect(selectReplacementHotSpare(snapshot, NOW)).toBeNull();
  });

  it("honors excludeAssetIds", () => {
    expect(selectReplacementHotSpare(baseSnapshot(), NOW, undefined, ["cam-1"])).toBe("cam-2");
  });
});

describe("handleAssetFailure", () => {
  it("deploys the spare into the failed camera's slot and promotes a replacement", () => {
    const snapshot = baseSnapshot();
    const withFailure: FleetSnapshot = {
      ...snapshot,
      assets: snapshot.assets.map((a) => (a.id === "cam-2" ? { ...a, status: "MAINTENANCE" as const } : a)),
    };

    const { snapshot: result, events } = handleAssetFailure(withFailure, "cam-2", NOW);

    const deployedSpare = result.assets.find((a) => a.id === "spare")!;
    expect(deployedSpare.isHotSpare).toBe(false);
    expect(deployedSpare.partnerId).toBe("loc-a"); // took over cam-2's position

    const newSpare = result.assets.find((a) => a.id === "cam-1")!;
    expect(newSpare.isHotSpare).toBe(true);

    expect(events).toEqual([
      { type: "HOT_SPARE_DEPLOYED", deployedAssetId: "spare", replacingAssetId: "cam-2" },
      { type: "HOT_SPARE_REPLACED", newHotSpareAssetId: "cam-1" },
    ]);
  });

  it("skips a camera a confirmed booking needs when choosing the replacement", () => {
    const snapshot = baseSnapshot();
    const withFailure: FleetSnapshot = {
      ...snapshot,
      assets: snapshot.assets.map((a) => (a.id === "cam-2" ? { ...a, status: "MAINTENANCE" as const } : a)),
      bookings: [{ id: "bkg-1", assetId: "cam-1", status: "CONFIRMED", startTime: SOON, endTime: LATER }],
    };

    const { events } = handleAssetFailure(withFailure, "cam-2", NOW);
    expect(events[1]).toEqual({ type: "HOT_SPARE_REPLACED", newHotSpareAssetId: "cam-3" });
  });

  it("does not immediately re-promote the just-deployed unit even if it would sort first", () => {
    const snapshot = baseSnapshot();
    const withFailure: FleetSnapshot = {
      ...snapshot,
      // give the deployed spare a human_id that would normally sort first
      assets: snapshot.assets.map((a) => {
        if (a.id === "spare") return { ...a, humanId: "CAM-001" };
        if (a.id === "cam-2") return { ...a, status: "MAINTENANCE" as const };
        return a;
      }),
    };

    const { events } = handleAssetFailure(withFailure, "cam-2", NOW);
    expect(events[1]).toEqual({ type: "HOT_SPARE_REPLACED", newHotSpareAssetId: "cam-1" });
  });

  it("leaves the fleet without a spare when no candidate is eligible", () => {
    const snapshot = baseSnapshot();
    const withFailure: FleetSnapshot = {
      ...snapshot,
      assets: snapshot.assets.map((a) => (a.id === "cam-2" ? { ...a, status: "MAINTENANCE" as const } : a)),
      bookings: [
        { id: "b1", assetId: "cam-1", status: "CONFIRMED", startTime: SOON, endTime: LATER },
        { id: "b3", assetId: "cam-3", status: "CONFIRMED", startTime: SOON, endTime: LATER },
      ],
    };

    const { snapshot: result, events } = handleAssetFailure(withFailure, "cam-2", NOW);
    expect(result.assets.some((a) => a.isHotSpare)).toBe(false);
    expect(events[1]).toEqual({ type: "NO_REPLACEMENT_AVAILABLE" });
  });

  it("is a no-op when there is no current hot spare", () => {
    const snapshot = baseSnapshot();
    const noSpare: FleetSnapshot = {
      ...snapshot,
      assets: snapshot.assets.map((a) => (a.id === "spare" ? { ...a, isHotSpare: false } : a)),
    };
    const { snapshot: result, events } = handleAssetFailure(noSpare, "cam-2", NOW);
    expect(result).toBe(noSpare);
    expect(events).toEqual([]);
  });

  it("throws if the target asset isn't actually failed", () => {
    expect(() => handleAssetFailure(baseSnapshot(), "cam-2", NOW)).toThrow(/not in a failed state/);
  });
});

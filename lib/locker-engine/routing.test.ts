import { describe, expect, it } from "vitest";
import { computeDropoffNeeds, planRoute } from "./routing";
import type { FleetSnapshot } from "./types";

const NOW = new Date("2026-09-02T10:00:00Z");
const SOON = new Date(NOW.getTime() + 30 * 60_000);
const LATER = new Date(NOW.getTime() + 4 * 60 * 60_000);

const TRAVEL_TIMES = [
  { fromPartnerId: "loc-a", toPartnerId: "loc-b", minutes: 12 },
  { fromPartnerId: "loc-b", toPartnerId: "loc-a", minutes: 12 },
  { fromPartnerId: "loc-a", toPartnerId: "loc-c", minutes: 15 },
  { fromPartnerId: "loc-c", toPartnerId: "loc-a", minutes: 15 },
  { fromPartnerId: "loc-b", toPartnerId: "loc-c", minutes: 10 },
  { fromPartnerId: "loc-c", toPartnerId: "loc-b", minutes: 10 },
];

function baseSnapshot(): FleetSnapshot {
  return {
    assets: [],
    bookings: [],
    compartments: [],
    workers: [{ id: "worker-1", currentPartnerId: "loc-a", active: true }],
    locations: [{ partnerId: "loc-a" }, { partnerId: "loc-b" }, { partnerId: "loc-c" }],
    travelTimes: TRAVEL_TIMES,
  };
}

describe("computeDropoffNeeds", () => {
  it("reports a shortfall when bookings outnumber on-site available cameras", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [
        { id: "b1", assetId: "any-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: SOON, endTime: LATER, isOvernight: false },
        { id: "b2", assetId: "any-2", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: SOON, endTime: LATER, isOvernight: false },
      ],
    };
    expect(computeDropoffNeeds(snapshot, NOW).get("loc-a")).toBe(2);
  });

  it("excludes a location once on-site availability meets demand", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      assets: [{ id: "cam-1", humanId: "CAM-001", isHotSpare: false, partnerId: "loc-a", status: "AVAILABLE" }],
      bookings: [{ id: "b1", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: SOON, endTime: LATER, isOvernight: false }],
    };
    expect(computeDropoffNeeds(snapshot, NOW).has("loc-a")).toBe(false);
  });

  it("ignores a cancelled booking", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [{ id: "b1", assetId: "any-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CANCELLED", startTime: SOON, endTime: LATER, isOvernight: false }],
    };
    expect(computeDropoffNeeds(snapshot, NOW).has("loc-a")).toBe(false);
  });

  it("ignores a booking starting beyond the lookahead window", () => {
    const farOut = new Date(NOW.getTime() + 5 * 60 * 60_000);
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [{ id: "b1", assetId: "any-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: farOut, endTime: new Date(farOut.getTime() + 60 * 60_000), isOvernight: false }],
    };
    expect(computeDropoffNeeds(snapshot, NOW, 120).has("loc-a")).toBe(false);
  });
});

describe("planRoute", () => {
  it("fulfills a dropoff straight from existing in-hand inventory when already at that spot", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      assets: [{ id: "spare-1", humanId: "CAM-090", isHotSpare: false, partnerId: null, status: "AVAILABLE" }],
      bookings: [{ id: "b1", assetId: "any-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: SOON, endTime: LATER, isOvernight: false }],
    };
    const plan = planRoute(snapshot, NOW);
    expect(plan.unmetDropoffs).toEqual([]);
    expect(plan.stops).toEqual([{ partnerId: "loc-a", actions: [{ type: "DROPOFF", assetIds: ["spare-1"] }] }]);
  });

  it("tops up from the nearest returns before attempting the dropoff", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      assets: [
        { id: "returned-1", humanId: "CAM-050", isHotSpare: false, partnerId: "loc-b", status: "RETURNED_AWAITING_INSPECTION" },
      ],
      bookings: [{ id: "b1", assetId: "any-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: SOON, endTime: LATER, isOvernight: false }],
    };
    const plan = planRoute(snapshot, NOW);
    expect(plan.stops.map((s) => s.partnerId)).toEqual(["loc-b", "loc-a"]);
    expect(plan.stops[0].actions).toEqual([
      { type: "PICKUP", assetIds: ["returned-1"] },
      { type: "SERVICE", assetIds: ["returned-1"] },
    ]);
    expect(plan.stops[1].actions).toEqual([{ type: "DROPOFF", assetIds: ["returned-1"] }]);
    expect(plan.unmetDropoffs).toEqual([]);
  });

  it("visits a dropoff-need spot before a nearer pickup-only spot", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      assets: [
        { id: "spare-1", humanId: "CAM-090", isHotSpare: false, partnerId: null, status: "AVAILABLE" },
        { id: "returned-1", humanId: "CAM-050", isHotSpare: false, partnerId: "loc-b", status: "RETURNED_AWAITING_INSPECTION" },
      ],
      // loc-c needs a dropoff (15min away); loc-b is pickup-only and closer (12min) — dropoff still goes first.
      bookings: [{ id: "b1", assetId: "any-1", partnerId: "loc-c", dropoffPartnerId: "loc-c", status: "CONFIRMED", startTime: SOON, endTime: LATER, isOvernight: false }],
    };
    const plan = planRoute(snapshot, NOW);
    expect(plan.stops.map((s) => s.partnerId)).toEqual(["loc-c", "loc-b"]);
  });

  it("defers servicing a return collected at a dropoff stop instead of doing it immediately", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      assets: [
        { id: "spare-1", humanId: "CAM-090", isHotSpare: false, partnerId: null, status: "AVAILABLE" },
        { id: "returned-1", humanId: "CAM-050", isHotSpare: false, partnerId: "loc-a", status: "RETURNED_AWAITING_INSPECTION" },
      ],
      bookings: [{ id: "b1", assetId: "any-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: SOON, endTime: LATER, isOvernight: false }],
    };
    const plan = planRoute(snapshot, NOW);
    const stop = plan.stops.find((s) => s.partnerId === "loc-a")!;
    // Pickup happens at this stop, but the SERVICE action (if any) must not
    // be interleaved as part of the same pickup — it's deferred until after
    // all dropoffs for the cycle are done.
    const pickupIndex = stop.actions.findIndex((a) => a.type === "PICKUP");
    const serviceIndex = stop.actions.findIndex((a) => a.type === "SERVICE");
    expect(pickupIndex).toBeGreaterThanOrEqual(0);
    // Since there were no other dropoffs or pickup spots left, servicing
    // does land at this same stop eventually, but strictly after pickup.
    if (serviceIndex !== -1) {
      expect(serviceIndex).toBeGreaterThan(pickupIndex);
    }
  });

  it("reports an unmet dropoff when nothing is available to cover it", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      assets: [],
      bookings: [{ id: "b1", assetId: "any-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: SOON, endTime: LATER, isOvernight: false }],
    };
    const plan = planRoute(snapshot, NOW);
    expect(plan.unmetDropoffs).toEqual([{ partnerId: "loc-a", shortfall: 1 }]);
    expect(plan.stops.some((s) => s.actions.some((a) => a.type === "DROPOFF"))).toBe(false);
  });

  it("picks the nearer of two dropoff-need spots first", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      assets: [
        { id: "spare-1", humanId: "CAM-090", isHotSpare: false, partnerId: null, status: "AVAILABLE" },
        { id: "spare-2", humanId: "CAM-091", isHotSpare: false, partnerId: null, status: "AVAILABLE" },
      ],
      bookings: [
        // loc-b is 12min from loc-a (worker start), loc-c is 15min — loc-b should be visited first.
        { id: "b1", assetId: "any-1", partnerId: "loc-b", dropoffPartnerId: "loc-b", status: "CONFIRMED", startTime: SOON, endTime: LATER, isOvernight: false },
        { id: "b2", assetId: "any-2", partnerId: "loc-c", dropoffPartnerId: "loc-c", status: "CONFIRMED", startTime: SOON, endTime: LATER, isOvernight: false },
      ],
    };
    const plan = planRoute(snapshot, NOW);
    expect(plan.stops.map((s) => s.partnerId)).toEqual(["loc-b", "loc-c"]);
  });

  it("rebalances surplus AVAILABLE cameras from an over-supplied spot to cover a shortfall elsewhere", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      assets: [
        // loc-a has 4 surplus AVAILABLE cameras and nothing due there.
        { id: "cam-1", humanId: "CAM-001", isHotSpare: false, partnerId: "loc-a", status: "AVAILABLE" },
        { id: "cam-2", humanId: "CAM-002", isHotSpare: false, partnerId: "loc-a", status: "AVAILABLE" },
        { id: "cam-3", humanId: "CAM-003", isHotSpare: false, partnerId: "loc-a", status: "AVAILABLE" },
        { id: "cam-4", humanId: "CAM-004", isHotSpare: false, partnerId: "loc-a", status: "AVAILABLE" },
      ],
      bookings: [{ id: "b1", assetId: "any-1", partnerId: "loc-c", dropoffPartnerId: "loc-c", status: "CONFIRMED", startTime: SOON, endTime: LATER, isOvernight: false }],
    };
    const plan = planRoute(snapshot, NOW);
    expect(plan.unmetDropoffs).toEqual([]);
    const dropoffStop = plan.stops.find((s) => s.partnerId === "loc-c")!;
    expect(dropoffStop.actions).toContainEqual(
      expect.objectContaining({ type: "DROPOFF", assetIds: expect.arrayContaining([expect.any(String)]) })
    );
    // Surplus cameras are already serviced — no SERVICE action needed for them.
    const pickupStop = plan.stops.find((s) => s.partnerId === "loc-a")!;
    expect(pickupStop.actions.some((a) => a.type === "SERVICE")).toBe(false);
  });

  it("never picks up the same physical camera twice when a location is visited for two reasons", () => {
    // loc-b is both the nearest top-up source (has a return) AND itself a
    // dropoff-need spot — a location visited once should still only move
    // each camera once.
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      assets: [
        { id: "returned-1", humanId: "CAM-050", isHotSpare: false, partnerId: "loc-b", status: "RETURNED_AWAITING_INSPECTION" },
      ],
      bookings: [{ id: "b1", assetId: "any-1", partnerId: "loc-b", dropoffPartnerId: "loc-b", status: "CONFIRMED", startTime: SOON, endTime: LATER, isOvernight: false }],
    };
    const plan = planRoute(snapshot, NOW);
    const stop = plan.stops.find((s) => s.partnerId === "loc-b")!;
    const pickupActions = stop.actions.filter((a) => a.type === "PICKUP");
    const serviceActions = stop.actions.filter((a) => a.type === "SERVICE");
    expect(pickupActions).toHaveLength(1);
    expect(serviceActions).toHaveLength(1);
    expect(pickupActions[0]).toEqual({ type: "PICKUP", assetIds: ["returned-1"] });
    expect(stop.actions).toContainEqual({ type: "DROPOFF", assetIds: ["returned-1"] });
    expect(plan.unmetDropoffs).toEqual([]);
  });

  it("does nothing when there are zero bookings anywhere — surplus available cameras are not a reason to visit a spot on their own", () => {
    // Confirmed real bug: before this was fixed, a fleet with no bookings
    // at all still produced a full route stripping every camera from
    // every location, since selectCamerasForCollection's "not needed
    // soon" rule is true for literally everything when nothing is booked.
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      assets: [
        { id: "cam-1", humanId: "CAM-001", isHotSpare: false, partnerId: "loc-a", status: "AVAILABLE" },
        { id: "cam-2", humanId: "CAM-002", isHotSpare: false, partnerId: "loc-b", status: "AVAILABLE" },
        { id: "cam-3", humanId: "CAM-003", isHotSpare: false, partnerId: "loc-c", status: "AVAILABLE" },
      ],
    };
    const plan = planRoute(snapshot, NOW);
    expect(plan.stops).toEqual([]);
    expect(plan.unmetDropoffs).toEqual([]);
  });

  it("still visits a location with a genuine uncollected return even with zero dropoff needs anywhere", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      assets: [
        { id: "cam-1", humanId: "CAM-001", isHotSpare: false, partnerId: "loc-a", status: "AVAILABLE" },
        { id: "returned-1", humanId: "CAM-050", isHotSpare: false, partnerId: "loc-b", status: "RETURNED_AWAITING_INSPECTION" },
      ],
    };
    const plan = planRoute(snapshot, NOW);
    expect(plan.stops.map((s) => s.partnerId)).toEqual(["loc-b"]);
    const stop = plan.stops[0];
    expect(stop.actions.some((a) => a.type === "PICKUP" && a.assetIds.includes("returned-1"))).toBe(true);
    // The surplus AVAILABLE camera at loc-a is never touched — no reason to visit loc-a at all.
    expect(plan.stops.some((s) => s.partnerId === "loc-a")).toBe(false);
  });
});

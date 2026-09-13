import { describe, expect, it } from "vitest";
import { chooseStop } from "./photoDelivery";
import type { RouteStop } from "./routing";
import type { FleetSnapshot } from "./types";

function snapshotWithTravelTimes(times: [string, string, number][]): FleetSnapshot {
  return {
    assets: [],
    bookings: [],
    compartments: [],
    workers: [],
    locations: [],
    travelTimes: times.map(([fromPartnerId, toPartnerId, minutes]) => ({ fromPartnerId, toPartnerId, minutes })),
  };
}

const DROPOFF_STOP: RouteStop = { partnerId: "hotel-urgent", actions: [{ type: "DROPOFF", assetIds: ["cam-1"] }] };
const RETURN_ONLY_STOP: RouteStop = { partnerId: "hotel-return", actions: [{ type: "PICKUP", assetIds: ["cam-2"] }] };

describe("chooseStop", () => {
  it("always sends the worker to an urgent dropoff, ignoring photo deliveries entirely", () => {
    const snapshot = snapshotWithTravelTimes([
      ["van", "hotel-urgent", 30],
      ["van", "hotel-photos", 1], // far closer, but must not win over a real booking dropoff
    ]);
    const photoDeliveries = new Map([["hotel-photos", [{ id: "o1", customerName: "Guest", size: "4R", quantity: 5, slotNumber: 12 }]]]);

    const result = chooseStop(snapshot, "van", DROPOFF_STOP, photoDeliveries);
    expect(result).toEqual({ partnerId: "hotel-urgent", fromPlan: true });
  });

  it("picks a photo delivery over a farther return-only stop once there's no dropoff urgency", () => {
    const snapshot = snapshotWithTravelTimes([
      ["van", "hotel-return", 30],
      ["van", "hotel-photos", 5],
    ]);
    const photoDeliveries = new Map([["hotel-photos", [{ id: "o1", customerName: "Guest", size: "4R", quantity: 5, slotNumber: 12 }]]]);

    const result = chooseStop(snapshot, "van", RETURN_ONLY_STOP, photoDeliveries);
    expect(result).toEqual({ partnerId: "hotel-photos", fromPlan: false });
  });

  it("still picks the return-only stop when it's nearer than any photo delivery", () => {
    const snapshot = snapshotWithTravelTimes([
      ["van", "hotel-return", 5],
      ["van", "hotel-photos", 30],
    ]);
    const photoDeliveries = new Map([["hotel-photos", [{ id: "o1", customerName: "Guest", size: "4R", quantity: 5, slotNumber: 12 }]]]);

    const result = chooseStop(snapshot, "van", RETURN_ONLY_STOP, photoDeliveries);
    expect(result).toEqual({ partnerId: "hotel-return", fromPlan: true });
  });

  it("synthesizes a photo-only stop when there's no camera work planned at all", () => {
    const snapshot = snapshotWithTravelTimes([["van", "hotel-photos", 10]]);
    const photoDeliveries = new Map([["hotel-photos", [{ id: "o1", customerName: "Guest", size: "4R", quantity: 10, slotNumber: 12 }]]]);

    const result = chooseStop(snapshot, "van", null, photoDeliveries);
    expect(result).toEqual({ partnerId: "hotel-photos", fromPlan: false });
  });

  it("returns null when there's nothing to do at all", () => {
    const snapshot = snapshotWithTravelTimes([]);
    const result = chooseStop(snapshot, "van", null, new Map());
    expect(result).toBeNull();
  });

  it("picks the nearest of several pending photo deliveries", () => {
    const snapshot = snapshotWithTravelTimes([
      ["van", "hotel-far", 20],
      ["van", "hotel-near", 5],
    ]);
    const photoDeliveries = new Map([
      ["hotel-far", [{ id: "o1", customerName: "A", size: "4R", quantity: 5, slotNumber: 12 }]],
      ["hotel-near", [{ id: "o2", customerName: "B", size: "4R", quantity: 5, slotNumber: 12 }]],
    ]);

    const result = chooseStop(snapshot, "van", null, photoDeliveries);
    expect(result).toEqual({ partnerId: "hotel-near", fromPlan: false });
  });
});

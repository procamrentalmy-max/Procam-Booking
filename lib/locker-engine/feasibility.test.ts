import { describe, expect, it } from "vitest";
import { alignToNextHour, checkBookingFeasibility } from "./feasibility";
import type { FleetSnapshot } from "./types";

const ALIGNED_10AM = new Date("2026-09-02T10:00:00Z");

function baseSnapshot(): FleetSnapshot {
  return {
    assets: [
      { id: "cam-1", humanId: "CAM-070", isHotSpare: false, partnerId: "loc-a", status: "AVAILABLE" },
      { id: "cam-2", humanId: "CAM-071", isHotSpare: false, partnerId: "loc-a", status: "AVAILABLE" },
      { id: "spare", humanId: "CAM-076", isHotSpare: true, partnerId: null, status: "AVAILABLE" },
    ],
    bookings: [],
    compartments: [],
    workers: [],
  };
}

describe("alignToNextHour", () => {
  it("leaves an already-aligned time untouched", () => {
    const t = new Date("2026-09-02T10:00:00.000Z");
    expect(alignToNextHour(t).toISOString()).toBe(t.toISOString());
  });

  it("rounds a non-aligned time up to the next hour", () => {
    const t = new Date("2026-09-02T10:15:00Z");
    expect(alignToNextHour(t).toISOString()).toBe("2026-09-02T11:00:00.000Z");
  });

  it("rounds a time 1ms past the hour up to the next hour", () => {
    const t = new Date("2026-09-02T10:00:00.001Z");
    expect(alignToNextHour(t).toISOString()).toBe("2026-09-02T11:00:00.000Z");
  });
});

describe("checkBookingFeasibility", () => {
  it("confirms at the requested (already-aligned) hour when a camera is free", () => {
    const result = checkBookingFeasibility(baseSnapshot(), {
      durationMinutes: 240,
      earliestStartTime: ALIGNED_10AM,
    });
    expect(result).toEqual({
      outcome: "CONFIRM",
      assetId: "cam-1",
      startTime: ALIGNED_10AM,
      endTime: new Date(ALIGNED_10AM.getTime() + 240 * 60_000),
    });
  });

  it("never offers the hot spare, even when it's the only free camera", () => {
    const farFuture = new Date(ALIGNED_10AM.getTime() + 1000 * 60 * 60_000); // both busy well past the lookahead
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [
        { id: "b1", assetId: "cam-1", status: "CONFIRMED", startTime: ALIGNED_10AM, endTime: farFuture },
        { id: "b2", assetId: "cam-2", status: "CONFIRMED", startTime: ALIGNED_10AM, endTime: farFuture },
      ],
    };
    const result = checkBookingFeasibility(snapshot, { durationMinutes: 240, earliestStartTime: ALIGNED_10AM }, 5);
    expect(result).toEqual({ outcome: "INFEASIBLE" });
  });

  it("skips MAINTENANCE/LOST/RETIRED cameras as candidates", () => {
    const snapshot = baseSnapshot();
    const withMaintenance: FleetSnapshot = {
      ...snapshot,
      assets: snapshot.assets.map((a) => (a.id === "cam-1" ? { ...a, status: "MAINTENANCE" as const } : a)),
    };
    const result = checkBookingFeasibility(withMaintenance, { durationMinutes: 240, earliestStartTime: ALIGNED_10AM });
    expect(result).toMatchObject({ outcome: "CONFIRM", assetId: "cam-2" });
  });

  it("picks the lowest human_id when multiple cameras are free (deterministic)", () => {
    const result = checkBookingFeasibility(baseSnapshot(), { durationMinutes: 240, earliestStartTime: ALIGNED_10AM });
    expect(result).toMatchObject({ assetId: "cam-1" });
  });

  it("offers the next feasible hourly slot when nothing is free at the requested hour", () => {
    const bookingEnd = new Date(ALIGNED_10AM.getTime() + 60 * 60_000); // both cameras busy 10:00-11:00
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [
        { id: "b1", assetId: "cam-1", status: "CONFIRMED", startTime: ALIGNED_10AM, endTime: bookingEnd },
        { id: "b2", assetId: "cam-2", status: "CONFIRMED", startTime: ALIGNED_10AM, endTime: bookingEnd },
      ],
    };
    const result = checkBookingFeasibility(snapshot, { durationMinutes: 60, earliestStartTime: ALIGNED_10AM });
    expect(result).toEqual({
      outcome: "NEXT_FEASIBLE_SLOT",
      assetId: "cam-1",
      startTime: bookingEnd, // 11:00 — half-open interval, abutting booking doesn't block
      endTime: new Date(bookingEnd.getTime() + 60 * 60_000),
    });
  });

  it("returns INFEASIBLE when nothing frees up within the lookahead window", () => {
    const farFuture = new Date(ALIGNED_10AM.getTime() + 1000 * 60 * 60_000); // way beyond any lookahead
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [
        { id: "b1", assetId: "cam-1", status: "CONFIRMED", startTime: ALIGNED_10AM, endTime: farFuture },
        { id: "b2", assetId: "cam-2", status: "CONFIRMED", startTime: ALIGNED_10AM, endTime: farFuture },
      ],
    };
    const result = checkBookingFeasibility(snapshot, { durationMinutes: 60, earliestStartTime: ALIGNED_10AM }, 5);
    expect(result).toEqual({ outcome: "INFEASIBLE" });
  });

  it("ignores a cancelled booking that would otherwise block the requested slot", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [
        { id: "b1", assetId: "cam-1", status: "CANCELLED", startTime: ALIGNED_10AM, endTime: new Date(ALIGNED_10AM.getTime() + 240 * 60_000) },
      ],
    };
    const result = checkBookingFeasibility(snapshot, { durationMinutes: 240, earliestStartTime: ALIGNED_10AM });
    expect(result).toMatchObject({ outcome: "CONFIRM", assetId: "cam-1" });
  });
});

import { describe, expect, it } from "vitest";
import { ASSET_TURNAROUND_MINUTES, InvalidBookingRequestError, alignToNextHour, checkBookingFeasibility, findEligibleAsset, isAssetReadyFor } from "./feasibility";
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
    locations: [],
    travelTimes: [],
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

describe("isAssetReadyFor", () => {
  const START = new Date("2026-09-02T14:00:00Z");

  it("is always ready when its status is AVAILABLE, regardless of booking history", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [{ id: "b1", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "COMPLETED", startTime: new Date(START.getTime() - 3_600_000), endTime: new Date(START.getTime() - 60_000), isOvernight: false }],
    };
    expect(isAssetReadyFor(snapshot, "cam-1", "AVAILABLE", START)).toBe(true);
  });

  it("is ready when nothing has occupied it at all", () => {
    expect(isAssetReadyFor(baseSnapshot(), "cam-1", "CLEANING", START)).toBe(true);
  });

  it("is not ready when its last occupying booking ended less than the turnaround buffer ago", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [{ id: "b1", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "COMPLETED", startTime: new Date(START.getTime() - 3_600_000), endTime: new Date(START.getTime() - 60_000), isOvernight: false }],
    };
    expect(isAssetReadyFor(snapshot, "cam-1", "CLEANING", START)).toBe(false);
  });

  it("is ready at exactly the turnaround buffer boundary", () => {
    const endTime = new Date(START.getTime() - ASSET_TURNAROUND_MINUTES * 60_000);
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [{ id: "b1", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "COMPLETED", startTime: new Date(endTime.getTime() - 3_600_000), endTime, isOvernight: false }],
    };
    expect(isAssetReadyFor(snapshot, "cam-1", "CLEANING", START)).toBe(true);
  });

  it("counts a COMPLETED booking toward the buffer — a booking that finished its full lifecycle is exactly the case the buffer exists for", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [{ id: "b1", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "COMPLETED", startTime: new Date(START.getTime() - 3_600_000), endTime: new Date(START.getTime() - 60_000), isOvernight: false }],
    };
    expect(isAssetReadyFor(snapshot, "cam-1", "CHARGING", START)).toBe(false);
  });

  it("ignores a CANCELLED or EXPIRED booking — it never actually occupied the camera", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [
        { id: "b1", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CANCELLED", startTime: new Date(START.getTime() - 3_600_000), endTime: new Date(START.getTime() - 60_000), isOvernight: false },
        { id: "b2", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "EXPIRED", startTime: new Date(START.getTime() - 3_600_000), endTime: new Date(START.getTime() - 60_000), isOvernight: false },
      ],
    };
    expect(isAssetReadyFor(snapshot, "cam-1", "AVAILABLE", START)).toBe(true);
  });

  it("ignores location entirely — a different partnerId on the prior booking has no bearing", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [{ id: "b1", assetId: "cam-1", partnerId: "loc-b", dropoffPartnerId: "loc-b", status: "COMPLETED", startTime: new Date(START.getTime() - 3 * 3_600_000), endTime: new Date(START.getTime() - ASSET_TURNAROUND_MINUTES * 60_000), isOvernight: false }],
    };
    expect(isAssetReadyFor(snapshot, "cam-1", "CLEANING", START)).toBe(true);
  });
});

describe("findEligibleAsset", () => {
  it("finds nothing for a combined multi-hour window neither camera covers alone, even though each half is individually free", () => {
    // This is exactly the gap the booking wizard's timetable used to miss:
    // greying only bare 1-hour windows made 1pm and 2pm both look free
    // individually, even though no single camera actually spans 1pm-3pm.
    const hour1 = new Date("2026-09-02T13:00:00Z");
    const hour2 = new Date("2026-09-02T14:00:00Z");
    const hour3 = new Date("2026-09-02T15:00:00Z");
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [
        // cam-1 is busy 2-3pm, so it's only free for the 1-2pm half.
        { id: "b1", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: hour2, endTime: hour3, isOvernight: false },
        // cam-2 is busy 1-2pm, so it's only free for the 2-3pm half.
        { id: "b2", assetId: "cam-2", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: hour1, endTime: hour2, isOvernight: false },
      ],
    };

    expect(findEligibleAsset(snapshot, hour1, hour2)).toBe("cam-1");
    expect(findEligibleAsset(snapshot, hour2, hour3)).toBe("cam-2");
    expect(findEligibleAsset(snapshot, hour1, hour3)).toBeNull();
  });
});

describe("checkBookingFeasibility", () => {
  it("confirms at the requested (already-aligned) hour when a camera is free", () => {
    const result = checkBookingFeasibility(
      baseSnapshot(),
      { durationMinutes: 240, earliestStartTime: ALIGNED_10AM },
      ALIGNED_10AM
    );
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
        { id: "b1", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: ALIGNED_10AM, endTime: farFuture, isOvernight: false },
        { id: "b2", assetId: "cam-2", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: ALIGNED_10AM, endTime: farFuture, isOvernight: false },
      ],
    };
    const result = checkBookingFeasibility(snapshot, { durationMinutes: 240, earliestStartTime: ALIGNED_10AM }, ALIGNED_10AM, 5);
    expect(result).toEqual({ outcome: "INFEASIBLE" });
  });

  it("skips MAINTENANCE/LOST/RETIRED cameras as candidates", () => {
    const snapshot = baseSnapshot();
    const withMaintenance: FleetSnapshot = {
      ...snapshot,
      assets: snapshot.assets.map((a) => (a.id === "cam-1" ? { ...a, status: "MAINTENANCE" as const } : a)),
    };
    const result = checkBookingFeasibility(withMaintenance, { durationMinutes: 240, earliestStartTime: ALIGNED_10AM }, ALIGNED_10AM);
    expect(result).toMatchObject({ outcome: "CONFIRM", assetId: "cam-2" });
  });

  it("picks the lowest human_id when multiple cameras are free (deterministic)", () => {
    const result = checkBookingFeasibility(baseSnapshot(), { durationMinutes: 240, earliestStartTime: ALIGNED_10AM }, ALIGNED_10AM);
    expect(result).toMatchObject({ assetId: "cam-1" });
  });

  it("offers the next feasible hourly slot when nothing is free at the requested hour", () => {
    const bookingEnd = new Date(ALIGNED_10AM.getTime() + 60 * 60_000); // both cameras busy 10:00-11:00
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [
        { id: "b1", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: ALIGNED_10AM, endTime: bookingEnd, isOvernight: false },
        { id: "b2", assetId: "cam-2", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: ALIGNED_10AM, endTime: bookingEnd, isOvernight: false },
      ],
    };
    const result = checkBookingFeasibility(snapshot, { durationMinutes: 60, earliestStartTime: ALIGNED_10AM }, ALIGNED_10AM);
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
        { id: "b1", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: ALIGNED_10AM, endTime: farFuture, isOvernight: false },
        { id: "b2", assetId: "cam-2", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: ALIGNED_10AM, endTime: farFuture, isOvernight: false },
      ],
    };
    const result = checkBookingFeasibility(snapshot, { durationMinutes: 60, earliestStartTime: ALIGNED_10AM }, ALIGNED_10AM, 5);
    expect(result).toEqual({ outcome: "INFEASIBLE" });
  });

  it("ignores a cancelled booking that would otherwise block the requested slot", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [
        { id: "b1", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CANCELLED", startTime: ALIGNED_10AM, endTime: new Date(ALIGNED_10AM.getTime() + 240 * 60_000), isOvernight: false },
      ],
    };
    const result = checkBookingFeasibility(snapshot, { durationMinutes: 240, earliestStartTime: ALIGNED_10AM }, ALIGNED_10AM);
    expect(result).toMatchObject({ outcome: "CONFIRM", assetId: "cam-1" });
  });

  it("throws for a request starting in the past instead of silently confirming it", () => {
    const past = new Date(ALIGNED_10AM.getTime() - 60 * 60_000);
    expect(() =>
      checkBookingFeasibility(baseSnapshot(), { durationMinutes: 60, earliestStartTime: past }, ALIGNED_10AM)
    ).toThrow(InvalidBookingRequestError);
  });

  it("allows a request whose earliestStartTime is exactly now", () => {
    const result = checkBookingFeasibility(baseSnapshot(), { durationMinutes: 60, earliestStartTime: ALIGNED_10AM }, ALIGNED_10AM);
    expect(result).toMatchObject({ outcome: "CONFIRM" });
  });

  it("throws for a zero-length duration", () => {
    expect(() =>
      checkBookingFeasibility(baseSnapshot(), { durationMinutes: 0, earliestStartTime: ALIGNED_10AM }, ALIGNED_10AM)
    ).toThrow(InvalidBookingRequestError);
  });

  it("throws for a negative duration instead of confirming an inverted time window", () => {
    expect(() =>
      checkBookingFeasibility(baseSnapshot(), { durationMinutes: -60, earliestStartTime: ALIGNED_10AM }, ALIGNED_10AM)
    ).toThrow(InvalidBookingRequestError);
  });
});

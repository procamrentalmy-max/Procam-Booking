import { describe, expect, it } from "vitest";
import {
  alignToNextInterval,
  droneReadyAt,
  isReturnLate,
  findEligibleDrone,
  findNextAvailableSlot,
  computeUnavailableStarts,
  firstAvailableAt,
  InvalidDroneBookingRequestError,
  type DroneCandidate,
  type BookingWindow,
} from "./slots";

function drones(): DroneCandidate[] {
  return [
    { id: "d1", humanId: "DRN-001", status: "AVAILABLE" },
    { id: "d2", humanId: "DRN-002", status: "AVAILABLE" },
  ];
}

describe("alignToNextInterval", () => {
  it("leaves an already-aligned time untouched", () => {
    const t = new Date("2026-09-02T10:30:00.000Z");
    expect(alignToNextInterval(t).toISOString()).toBe(t.toISOString());
  });

  it("rounds up to the next 30-minute mark", () => {
    expect(alignToNextInterval(new Date("2026-09-02T10:05:00Z")).toISOString()).toBe("2026-09-02T10:30:00.000Z");
    expect(alignToNextInterval(new Date("2026-09-02T10:31:00Z")).toISOString()).toBe("2026-09-02T11:00:00.000Z");
  });

  it("rounds a time 1ms past a mark up to the next one", () => {
    expect(alignToNextInterval(new Date("2026-09-02T10:30:00.001Z")).toISOString()).toBe("2026-09-02T11:00:00.000Z");
  });
});

describe("droneReadyAt — the worked example from spec (6:01 return -> 7:00 next slot)", () => {
  it("a drone due back at 6:01 is next bookable at 7:00 (6:01 + 30min buffer = 6:31, rounded up)", () => {
    const scheduledEnd = new Date("2026-09-02T06:01:00Z");
    expect(droneReadyAt(scheduledEnd).toISOString()).toBe("2026-09-02T07:00:00.000Z");
  });

  it("a drone due back exactly on a grid mark still gets the full buffer", () => {
    // 6:00 + 30min = 6:30, already aligned -> stays 6:30
    expect(droneReadyAt(new Date("2026-09-02T06:00:00Z")).toISOString()).toBe("2026-09-02T06:30:00.000Z");
  });
});

describe("isReturnLate", () => {
  const scheduledEnd = new Date("2026-09-02T06:00:00Z");

  it("is not late within the 15-minute grace window", () => {
    expect(isReturnLate(new Date("2026-09-02T06:15:00Z"), scheduledEnd)).toBe(false);
  });

  it("is late once past the grace window", () => {
    expect(isReturnLate(new Date("2026-09-02T06:15:00.001Z"), scheduledEnd)).toBe(true);
  });
});

describe("findEligibleDrone", () => {
  it("picks the lowest humanId drone when both are free", () => {
    const start = new Date("2026-09-02T10:00:00Z");
    const end = new Date("2026-09-02T11:00:00Z");
    expect(findEligibleDrone(drones(), [], start, end)).toBe("d1");
  });

  it("skips a drone still inside another booking's return buffer", () => {
    const bookings: BookingWindow[] = [
      { droneId: "d1", startTime: new Date("2026-09-02T04:00:00Z"), endTime: new Date("2026-09-02T06:01:00Z"), status: "ACTIVE" },
    ];
    // d1 isn't ready again until 7:00 (see droneReadyAt test above) — a 6:30 request must fall through to d2.
    const start = new Date("2026-09-02T06:30:00Z");
    const end = new Date("2026-09-02T07:30:00Z");
    expect(findEligibleDrone(drones(), bookings, start, end)).toBe("d2");
  });

  it("returns null when every drone is busy", () => {
    const bookings: BookingWindow[] = [
      { droneId: "d1", startTime: new Date("2026-09-02T09:00:00Z"), endTime: new Date("2026-09-02T11:00:00Z"), status: "CONFIRMED" },
      { droneId: "d2", startTime: new Date("2026-09-02T09:00:00Z"), endTime: new Date("2026-09-02T11:00:00Z"), status: "ACTIVE" },
    ];
    expect(findEligibleDrone(drones(), bookings, new Date("2026-09-02T10:00:00Z"), new Date("2026-09-02T10:30:00Z"))).toBeNull();
  });

  it("ignores a CANCELLED booking entirely — no return buffer applies", () => {
    const bookings: BookingWindow[] = [
      { droneId: "d1", startTime: new Date("2026-09-02T09:00:00Z"), endTime: new Date("2026-09-02T11:00:00Z"), status: "CANCELLED" },
    ];
    expect(findEligibleDrone(drones(), bookings, new Date("2026-09-02T09:30:00Z"), new Date("2026-09-02T10:00:00Z"))).toBe("d1");
  });

  it("excludes a drone under MAINTENANCE regardless of bookings", () => {
    const maintDrones: DroneCandidate[] = [{ id: "d1", humanId: "DRN-001", status: "MAINTENANCE" }];
    expect(findEligibleDrone(maintDrones, [], new Date("2026-09-02T10:00:00Z"), new Date("2026-09-02T10:30:00Z"))).toBeNull();
  });
});

describe("findNextAvailableSlot", () => {
  it("confirms the very next 30-minute slot with no minimum lead time", () => {
    const now = new Date("2026-09-02T10:05:00Z");
    const result = findNextAvailableSlot(drones(), [], 60, now);
    expect(result.outcome).toBe("CONFIRM");
    if (result.outcome !== "INFEASIBLE") {
      expect(result.startTime.toISOString()).toBe("2026-09-02T10:30:00.000Z");
      expect(result.endTime.toISOString()).toBe("2026-09-02T11:30:00.000Z");
    }
  });

  it("falls through to the next feasible slot once every drone is busy", () => {
    const bookings: BookingWindow[] = [
      { droneId: "d1", startTime: new Date("2026-09-02T10:00:00Z"), endTime: new Date("2026-09-02T11:00:00Z"), status: "CONFIRMED" },
      { droneId: "d2", startTime: new Date("2026-09-02T10:00:00Z"), endTime: new Date("2026-09-02T11:00:00Z"), status: "CONFIRMED" },
    ];
    const result = findNextAvailableSlot(drones(), bookings, 30, new Date("2026-09-02T10:00:00Z"));
    expect(result.outcome).toBe("NEXT_FEASIBLE_SLOT");
    // both ready at 11:30 (11:00 + 30min buffer, already aligned)
    if (result.outcome !== "INFEASIBLE") {
      expect(result.startTime.toISOString()).toBe("2026-09-02T11:30:00.000Z");
    }
  });

  it("throws on a non-positive duration", () => {
    expect(() => findNextAvailableSlot(drones(), [], 0, new Date())).toThrow(InvalidDroneBookingRequestError);
  });

  it("returns INFEASIBLE when the lookahead window is exhausted", () => {
    const result = findNextAvailableSlot([{ id: "d1", humanId: "DRN-001", status: "MAINTENANCE" }], [], 30, new Date(), 2);
    expect(result.outcome).toBe("INFEASIBLE");
  });
});

describe("computeUnavailableStarts", () => {
  it("flags only the starts with no eligible drone", () => {
    const bookings: BookingWindow[] = [
      { droneId: "d1", startTime: new Date("2026-09-02T10:00:00Z"), endTime: new Date("2026-09-02T11:00:00Z"), status: "CONFIRMED" },
      { droneId: "d2", startTime: new Date("2026-09-02T10:00:00Z"), endTime: new Date("2026-09-02T11:00:00Z"), status: "CONFIRMED" },
    ];
    const starts = [new Date("2026-09-02T09:30:00Z"), new Date("2026-09-02T10:00:00Z"), new Date("2026-09-02T12:00:00Z")];
    expect(computeUnavailableStarts(drones(), bookings, 30, starts)).toEqual([false, true, false]);
  });
});

describe("firstAvailableAt", () => {
  it("returns the soonest bookable time when a drone is free now", () => {
    const now = new Date("2026-09-02T10:05:00Z");
    expect(firstAvailableAt(drones(), [], now)?.toISOString()).toBe("2026-09-02T10:30:00.000Z");
  });

  it("returns null when nothing is ever eligible", () => {
    const maintDrones: DroneCandidate[] = [{ id: "d1", humanId: "DRN-001", status: "MAINTENANCE" }];
    expect(firstAvailableAt(maintDrones, [], new Date())).toBeNull();
  });
});

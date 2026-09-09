import { describe, expect, it } from "vitest";
import {
  InvalidBookingRequestError,
  checkLockerBookingFeasibility,
  checkOvernightBookingFeasibility,
} from "./bookingGate";
import type { FleetSnapshot } from "./types";

const TRAVEL_TIMES = [
  { fromPartnerId: "loc-a", toPartnerId: "loc-b", minutes: 15 },
  { fromPartnerId: "loc-b", toPartnerId: "loc-a", minutes: 15 },
];

function baseSnapshot(): FleetSnapshot {
  return {
    assets: [
      { id: "cam-1", humanId: "CAM-001", isHotSpare: false, partnerId: "loc-a", status: "AVAILABLE" },
      { id: "cam-2", humanId: "CAM-002", isHotSpare: false, partnerId: "loc-a", status: "AVAILABLE" },
    ],
    bookings: [],
    compartments: [],
    workers: [],
    locations: [{ partnerId: "loc-a" }, { partnerId: "loc-b" }],
    travelTimes: TRAVEL_TIMES,
  };
}

const NOW = new Date("2026-09-08T09:00:00Z");

describe("checkLockerBookingFeasibility", () => {
  it("throws for a non-positive duration", () => {
    expect(() =>
      checkLockerBookingFeasibility(baseSnapshot(), { partnerId: "loc-a", dropoffPartnerId: "loc-a", durationMinutes: 0, earliestStartTime: new Date(NOW.getTime() + 2 * 3_600_000) }, NOW)
    ).toThrow(InvalidBookingRequestError);
  });

  it("throws for a request inside the 2-hour minimum lead time", () => {
    expect(() =>
      checkLockerBookingFeasibility(baseSnapshot(), { partnerId: "loc-a", dropoffPartnerId: "loc-a", durationMinutes: 240, earliestStartTime: new Date(NOW.getTime() + 30 * 60_000) }, NOW)
    ).toThrow(/at least 120 minutes ahead/);
  });

  it("confirms when a camera is free", () => {
    const desiredStart = new Date("2026-09-08T11:00:00Z");
    const result = checkLockerBookingFeasibility(baseSnapshot(), { partnerId: "loc-a", dropoffPartnerId: "loc-a", durationMinutes: 240, earliestStartTime: desiredStart }, NOW);
    expect(result).toMatchObject({ outcome: "CONFIRM", startTime: desiredStart });
  });

  it("ignores location and travel time entirely — a camera whose prior booking was at a different location is still eligible once its turnaround buffer clears", () => {
    // Only camera in the fleet: previously at loc-b, ending exactly 2h
    // before this request at loc-a. Under the old engine this would have
    // needed extra travel-time room; now location plays no part at all.
    const priorEnd = new Date("2026-09-08T11:00:00Z");
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      assets: [{ id: "cam-1", humanId: "CAM-001", isHotSpare: false, partnerId: "loc-b", status: "RETURNED_AWAITING_INSPECTION" }],
      bookings: [
        { id: "existing", assetId: "cam-1", partnerId: "loc-b", dropoffPartnerId: "loc-b", status: "COMPLETED", startTime: new Date("2026-09-08T09:00:00Z"), endTime: priorEnd, isOvernight: false },
      ],
    };
    const requestedStart = new Date(priorEnd.getTime() + 120 * 60_000); // exactly 2h later, at loc-a
    const result = checkLockerBookingFeasibility(snapshot, { partnerId: "loc-a", dropoffPartnerId: "loc-a", durationMinutes: 120, earliestStartTime: requestedStart }, NOW);
    expect(result).toMatchObject({ outcome: "CONFIRM", assetId: "cam-1" });
  });

  it("pushes to a later hour when the only camera's prior booking ended less than 2 hours before the requested (hour-aligned) start", () => {
    const priorEnd = new Date("2026-09-08T11:00:00Z");
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      assets: [{ id: "cam-1", humanId: "CAM-001", isHotSpare: false, partnerId: "loc-a", status: "CLEANING" }],
      bookings: [
        { id: "existing", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "COMPLETED", startTime: new Date("2026-09-08T09:00:00Z"), endTime: priorEnd, isOvernight: false },
      ],
    };
    // Requesting 11:30 aligns to the 12:00 slot — only 1h after the prior
    // booking ended, short of the 2h buffer. The next hour that clears it
    // is 13:00 (exactly 2h after priorEnd).
    const requestedStart = new Date(priorEnd.getTime() + 30 * 60_000);
    const result = checkLockerBookingFeasibility(snapshot, { partnerId: "loc-a", dropoffPartnerId: "loc-a", durationMinutes: 60, earliestStartTime: requestedStart }, NOW);
    expect(result.outcome).toBe("NEXT_FEASIBLE_SLOT");
    if (result.outcome !== "INFEASIBLE") {
      expect(result.startTime.toISOString()).toBe("2026-09-08T13:00:00.000Z");
    }
  });

  it("treats an AVAILABLE camera as eligible immediately, even seconds after its prior booking ended", () => {
    const priorEnd = new Date("2026-09-08T11:00:00Z");
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      assets: [{ id: "cam-1", humanId: "CAM-001", isHotSpare: false, partnerId: "loc-a", status: "AVAILABLE" }],
      bookings: [
        { id: "existing", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "COMPLETED", startTime: new Date("2026-09-08T09:00:00Z"), endTime: priorEnd, isOvernight: false },
      ],
    };
    const requestedStart = new Date(priorEnd.getTime() + 60_000); // 1 minute later
    const result = checkLockerBookingFeasibility(snapshot, { partnerId: "loc-a", dropoffPartnerId: "loc-a", durationMinutes: 60, earliestStartTime: requestedStart }, NOW);
    expect(result).toMatchObject({ outcome: "CONFIRM", assetId: "cam-1" });
  });
});

describe("checkOvernightBookingFeasibility", () => {
  it("confirms tonight's 10pm-8am slot when requested well before the 8pm cutoff", () => {
    const night = new Date("2026-09-08T00:00:00");
    const result = checkOvernightBookingFeasibility(baseSnapshot(), { partnerId: "loc-a", dropoffPartnerId: "loc-a", earliestNight: night }, NOW);
    expect(result).toMatchObject({ outcome: "CONFIRM" });
    if (result.outcome !== "INFEASIBLE") {
      expect(result.startTime.getHours()).toBe(22);
      expect(result.endTime.getHours()).toBe(8);
    }
  });

  it("pushes to the next night when requested after the 8pm cutoff for tonight", () => {
    const lateRequestTime = new Date("2026-09-08T20:30:00");
    const night = new Date("2026-09-08T00:00:00");
    const result = checkOvernightBookingFeasibility(baseSnapshot(), { partnerId: "loc-a", dropoffPartnerId: "loc-a", earliestNight: night }, lateRequestTime);
    expect(result.outcome).toBe("NEXT_FEASIBLE_SLOT");
    if (result.outcome !== "INFEASIBLE") {
      expect(result.startTime.getDate()).toBe(9);
    }
  });

  it("scales capacity to however many cameras are actually free that night, with no travel-time cross-check between different overnight pickups", () => {
    const night = new Date("2026-09-08T00:00:00");
    // Two DIFFERENT overnight bookings already confirmed for tonight, at
    // loc-a and loc-b — under the old engine this needed a reachability
    // check; now it's pure inventory count, so a third pickup at either
    // location is fine as long as a camera is free.
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      assets: [
        { id: "cam-1", humanId: "CAM-001", isHotSpare: false, partnerId: "loc-a", status: "AVAILABLE" },
        { id: "cam-2", humanId: "CAM-002", isHotSpare: false, partnerId: "loc-a", status: "AVAILABLE" },
        { id: "cam-3", humanId: "CAM-003", isHotSpare: false, partnerId: "loc-a", status: "AVAILABLE" },
      ],
      bookings: [
        { id: "b1", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: new Date("2026-09-08T22:00:00"), endTime: new Date("2026-09-09T08:00:00"), isOvernight: true },
        { id: "b2", assetId: "cam-2", partnerId: "loc-b", dropoffPartnerId: "loc-b", status: "CONFIRMED", startTime: new Date("2026-09-08T22:00:00"), endTime: new Date("2026-09-09T08:00:00"), isOvernight: true },
      ],
    };
    const result = checkOvernightBookingFeasibility(snapshot, { partnerId: "loc-a", dropoffPartnerId: "loc-a", earliestNight: night }, NOW);
    expect(result).toMatchObject({ outcome: "CONFIRM", assetId: "cam-3" });
  });

  it("still enforces camera double-booking protection", () => {
    const night = new Date("2026-09-08T00:00:00");
    const oneEligibleCameraSnapshot: FleetSnapshot = {
      ...baseSnapshot(),
      assets: [
        { id: "cam-1", humanId: "CAM-001", isHotSpare: false, partnerId: "loc-a", status: "AVAILABLE" },
        { id: "cam-2", humanId: "CAM-002", isHotSpare: false, partnerId: "loc-a", status: "MAINTENANCE" },
      ],
      bookings: [
        { id: "b1", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: new Date("2026-09-08T22:00:00"), endTime: new Date("2026-09-09T08:00:00"), isOvernight: true },
      ],
    };
    const result = checkOvernightBookingFeasibility(oneEligibleCameraSnapshot, { partnerId: "loc-a", dropoffPartnerId: "loc-a", earliestNight: night }, NOW, 2);
    expect(result.outcome).toBe("NEXT_FEASIBLE_SLOT"); // pushed to the next available night
  });
});

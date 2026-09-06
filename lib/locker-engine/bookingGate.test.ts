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

// A Tuesday at 09:00 UTC — well clear of the worker's 7am UTC floor.
const NOW = new Date("2026-09-08T09:00:00Z");

describe("checkLockerBookingFeasibility", () => {
  it("throws for a non-positive duration", () => {
    expect(() =>
      checkLockerBookingFeasibility(baseSnapshot(), { partnerId: "loc-a", dropoffPartnerId: "loc-a", durationMinutes: 0, earliestStartTime: new Date(NOW.getTime() + 2 * 3_600_000) }, NOW)
    ).toThrow(InvalidBookingRequestError);
  });

  it("throws for a request inside the 1-hour minimum lead time", () => {
    expect(() =>
      checkLockerBookingFeasibility(baseSnapshot(), { partnerId: "loc-a", dropoffPartnerId: "loc-a", durationMinutes: 240, earliestStartTime: new Date(NOW.getTime() + 30 * 60_000) }, NOW)
    ).toThrow(/at least 60 minutes ahead/);
  });

  it("confirms when both camera and worker schedule are free", () => {
    const desiredStart = new Date("2026-09-08T11:00:00Z"); // 7pm Malaysia time, well after NOW's lead time
    const result = checkLockerBookingFeasibility(baseSnapshot(), { partnerId: "loc-a", dropoffPartnerId: "loc-a", durationMinutes: 240, earliestStartTime: desiredStart }, NOW);
    expect(result).toMatchObject({ outcome: "CONFIRM", startTime: desiredStart });
  });

  it("pushes to a later hour when the requested hour has no worker-schedule room, even though a camera is free", () => {
    // Existing booking at loc-b (6am-10am UTC = 2pm-6pm Malaysia time) whose
    // return commitment blocks 10:00 UTC at loc-a (different location, 15min
    // travel needed) — kept well within the same Malaysia calendar day so
    // this test isolates the travel-time conflict, not the 7am floor.
    const returnBlockStart = new Date("2026-09-08T10:00:00Z");
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [
        {
          id: "existing",
          assetId: "cam-2",
          partnerId: "loc-b",
          dropoffPartnerId: "loc-b",
          status: "CONFIRMED",
          startTime: new Date("2026-09-08T06:00:00Z"),
          endTime: returnBlockStart, // return commitment starts exactly at 10:00 UTC at loc-b
        },
      ],
    };
    // Requesting a NEW booking's setup at loc-a for 10:00 UTC — camera cam-1
    // is free, but the worker's return commitment for the existing booking
    // is at loc-b at the same moment, and there's no travel-time room
    // between them.
    const result = checkLockerBookingFeasibility(snapshot, { partnerId: "loc-a", dropoffPartnerId: "loc-a", durationMinutes: 240, earliestStartTime: returnBlockStart }, NOW);
    expect(result.outcome).toBe("NEXT_FEASIBLE_SLOT");
    if (result.outcome !== "INFEASIBLE") {
      expect(result.startTime.getTime()).toBeGreaterThan(returnBlockStart.getTime());
    }
  });
});

describe("checkOvernightBookingFeasibility", () => {
  it("confirms tonight's 10pm-8am slot when requested well before the 9pm cutoff", () => {
    const night = new Date("2026-09-08T00:00:00");
    const result = checkOvernightBookingFeasibility(baseSnapshot(), { partnerId: "loc-a", earliestNight: night }, NOW);
    expect(result).toMatchObject({ outcome: "CONFIRM" });
    if (result.outcome !== "INFEASIBLE") {
      expect(result.startTime.getHours()).toBe(22);
      expect(result.endTime.getHours()).toBe(8);
    }
  });

  it("pushes to the next night when requested after the 9pm cutoff for tonight", () => {
    const lateRequestTime = new Date("2026-09-08T21:30:00"); // past 9pm
    const night = new Date("2026-09-08T00:00:00");
    const result = checkOvernightBookingFeasibility(baseSnapshot(), { partnerId: "loc-a", earliestNight: night }, lateRequestTime);
    expect(result.outcome).toBe("NEXT_FEASIBLE_SLOT");
    if (result.outcome !== "INFEASIBLE") {
      expect(result.startTime.getDate()).toBe(9); // the 9th, not the 8th
    }
  });

  it("does NOT check worker-schedule feasibility — confirms even with a conflicting daytime commitment at the same moment", () => {
    const night = new Date("2026-09-08T00:00:00");
    // A daytime return commitment for a DIFFERENT location right at 22:00 — would
    // fail the daytime gate's worker-schedule check, but overnight ignores it.
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [
        { id: "existing", assetId: "cam-2", partnerId: "loc-b", dropoffPartnerId: "loc-b", status: "CONFIRMED", startTime: new Date("2026-09-08T18:00:00"), endTime: new Date("2026-09-08T22:00:00") },
      ],
    };
    const result = checkOvernightBookingFeasibility(snapshot, { partnerId: "loc-a", earliestNight: night }, NOW);
    expect(result).toMatchObject({ outcome: "CONFIRM" });
  });

  it("still enforces camera double-booking protection", () => {
    const night = new Date("2026-09-08T00:00:00");
    const bothCamerasBooked: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [
        { id: "b1", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: new Date("2026-09-08T22:00:00"), endTime: new Date("2026-09-09T08:00:00") },
        { id: "b2", assetId: "cam-2", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: new Date("2026-09-08T22:00:00"), endTime: new Date("2026-09-09T08:00:00") },
      ],
    };
    const result = checkOvernightBookingFeasibility(bothCamerasBooked, { partnerId: "loc-a", earliestNight: night }, NOW, 2);
    expect(result.outcome).toBe("NEXT_FEASIBLE_SLOT"); // pushed to the next available night
  });
});

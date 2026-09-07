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

  it("throws for a request inside the 2-hour minimum lead time", () => {
    expect(() =>
      checkLockerBookingFeasibility(baseSnapshot(), { partnerId: "loc-a", dropoffPartnerId: "loc-a", durationMinutes: 240, earliestStartTime: new Date(NOW.getTime() + 30 * 60_000) }, NOW)
    ).toThrow(/at least 120 minutes ahead/);
  });

  it("confirms when both camera and worker schedule are free", () => {
    const desiredStart = new Date("2026-09-08T11:00:00Z"); // 7pm Malaysia time, well after NOW's lead time
    const result = checkLockerBookingFeasibility(baseSnapshot(), { partnerId: "loc-a", dropoffPartnerId: "loc-a", durationMinutes: 240, earliestStartTime: desiredStart }, NOW);
    expect(result).toMatchObject({ outcome: "CONFIRM", startTime: desiredStart });
  });

  it("pushes to a later hour when the requested hour has no worker-schedule room, even though a camera is free", () => {
    // Existing booking at loc-b (8am-12pm UTC = 4pm-8pm Malaysia time) whose
    // return commitment blocks 12:00 UTC at loc-a (different location, 15min
    // travel needed) — kept well within the same Malaysia calendar day so
    // this test isolates the travel-time conflict, not the 7am floor. Set 3
    // hours after NOW to clear the 2-hour minimum lead time.
    const returnBlockStart = new Date("2026-09-08T12:00:00Z");
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [
        {
          id: "existing",
          assetId: "cam-2",
          partnerId: "loc-b",
          dropoffPartnerId: "loc-b",
          status: "CONFIRMED",
          startTime: new Date("2026-09-08T08:00:00Z"),
          endTime: returnBlockStart, // return commitment starts exactly at 12:00 UTC at loc-b
          isOvernight: false,
        },
      ],
    };
    // Requesting a NEW booking's setup at loc-a for 12:00 UTC — camera cam-1
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
    const lateRequestTime = new Date("2026-09-08T20:30:00"); // past the 2-hour-ahead 8pm cutoff
    const night = new Date("2026-09-08T00:00:00");
    const result = checkOvernightBookingFeasibility(baseSnapshot(), { partnerId: "loc-a", dropoffPartnerId: "loc-a", earliestNight: night }, lateRequestTime);
    expect(result.outcome).toBe("NEXT_FEASIBLE_SLOT");
    if (result.outcome !== "INFEASIBLE") {
      expect(result.startTime.getDate()).toBe(9); // the 9th, not the 8th
    }
  });

  it("now checks worker-schedule feasibility — pushed to the next night when the worker is still tied up past 10pm on a same-night daytime return", () => {
    const night = new Date("2026-09-08T00:00:00");
    // Overnight setup is flexible (can happen any time before 10pm), so a
    // daytime commitment that FINISHES before 10pm no longer blocks it —
    // the worker can detour to stage the overnight locker beforehand. But
    // if the daytime return's processing window itself doesn't finish
    // until AFTER 10pm (21:55 start + 25min grace/processing = 22:20), the
    // worker genuinely isn't free by the 10pm deadline, regardless of
    // where the overnight pickup is. This used to slip through entirely
    // when overnight skipped the worker-schedule check.
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [
        { id: "existing", assetId: "cam-2", partnerId: "loc-b", dropoffPartnerId: "loc-b", status: "CONFIRMED", startTime: new Date("2026-09-08T18:00:00"), endTime: new Date("2026-09-08T21:55:00"), isOvernight: false },
      ],
    };
    const result = checkOvernightBookingFeasibility(snapshot, { partnerId: "loc-a", dropoffPartnerId: "loc-a", earliestNight: night }, NOW);
    expect(result.outcome).toBe("NEXT_FEASIBLE_SLOT");
    if (result.outcome !== "INFEASIBLE") {
      expect(result.startTime.getDate()).toBe(9); // tonight is blocked; pushed to the next night
    }
  });

  it("allows a daytime booking that finishes with time to spare before 10pm — the worker can detour to stage the overnight locker first", () => {
    const night = new Date("2026-09-08T00:00:00");
    // Return commitment [17:15,17:40]@loc-b finishes hours before 10pm —
    // plenty of room for the worker to also visit loc-a and back.
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [
        { id: "existing", assetId: "cam-2", partnerId: "loc-b", dropoffPartnerId: "loc-b", status: "CONFIRMED", startTime: new Date("2026-09-08T13:00:00"), endTime: new Date("2026-09-08T17:15:00"), isOvernight: false },
      ],
    };
    const result = checkOvernightBookingFeasibility(snapshot, { partnerId: "loc-a", dropoffPartnerId: "loc-a", earliestNight: night }, NOW);
    expect(result).toMatchObject({ outcome: "CONFIRM" });
  });

  it("scales capacity to however many overnight pickups the worker can actually reach by 10pm, not a flat cap of one", () => {
    const night = new Date("2026-09-08T00:00:00");
    // Two DIFFERENT overnight bookings already confirmed for tonight, at
    // loc-a and loc-b (15 min apart) — nothing else on the schedule, so
    // the worker has the whole day to stage both. A third pickup at loc-a
    // (same location as the first, so no extra travel) should still fit.
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
    // Only one eligible camera (cam-2 is under MAINTENANCE) and it's already
    // booked for tonight elsewhere. Note: two DIFFERENT bookings both
    // claiming tonight's fixed 22:00 overnight slot would now also collide
    // on worker-schedule grounds (one worker can't run two simultaneous
    // setups), so that's no longer a state real usage could ever produce —
    // this isolates pure inventory exhaustion instead.
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

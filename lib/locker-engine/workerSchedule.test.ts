import { describe, expect, it } from "vitest";
import { commitmentsForBooking, existingCommitments, isWorkerScheduleFeasible, type WorkerCommitment } from "./workerSchedule";
import type { FleetSnapshot } from "./types";

const TRAVEL_TIMES = [
  { fromPartnerId: "loc-a", toPartnerId: "loc-b", minutes: 15 },
  { fromPartnerId: "loc-b", toPartnerId: "loc-a", minutes: 15 },
];

function baseSnapshot(): FleetSnapshot {
  return {
    assets: [],
    bookings: [],
    compartments: [],
    workers: [],
    locations: [{ partnerId: "loc-a" }, { partnerId: "loc-b" }],
    travelTimes: TRAVEL_TIMES,
  };
}

describe("commitmentsForBooking", () => {
  it("produces a setup window ending exactly at start_time and a return window starting exactly at end_time", () => {
    const start = new Date("2026-09-10T10:00:00Z");
    const end = new Date("2026-09-10T14:00:00Z");
    const [setup, ret] = commitmentsForBooking("loc-a", "loc-a", start, end);

    expect(setup.end.getTime()).toBe(start.getTime());
    expect(setup.start.getTime()).toBe(start.getTime() - 15 * 60_000);
    expect(ret.start.getTime()).toBe(end.getTime());
    expect(ret.end.getTime()).toBe(end.getTime() + (10 + 15) * 60_000);
  });
});

describe("existingCommitments", () => {
  it("derives commitments only from non-terminal bookings", () => {
    const snapshot: FleetSnapshot = {
      ...baseSnapshot(),
      bookings: [
        { id: "b1", assetId: "cam-1", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CONFIRMED", startTime: new Date("2026-09-10T10:00:00Z"), endTime: new Date("2026-09-10T14:00:00Z") },
        { id: "b2", assetId: "cam-2", partnerId: "loc-a", dropoffPartnerId: "loc-a", status: "CANCELLED", startTime: new Date("2026-09-10T10:00:00Z"), endTime: new Date("2026-09-10T14:00:00Z") },
      ],
    };
    expect(existingCommitments(snapshot)).toHaveLength(2); // 1 booking x 2 commitments
  });
});

describe("isWorkerScheduleFeasible", () => {
  it("allows a commitment on its own with no prior schedule", () => {
    // 02:00-06:00 UTC = 10am-2pm Malaysia time — comfortably clear of the 7am floor either side.
    const start = new Date("2026-09-10T02:00:00Z");
    const end = new Date("2026-09-10T06:00:00Z");
    const candidate = commitmentsForBooking("loc-a", "loc-a", start, end);
    expect(isWorkerScheduleFeasible([], candidate, baseSnapshot())).toBe(true);
  });

  it("rejects a commitment requiring presence before the worker's 7am Malaysia-time start", () => {
    // 23:05 UTC = 07:05 MYT — setup would need to start 06:50 MYT.
    const start = new Date("2026-09-09T23:05:00Z");
    const end = new Date("2026-09-10T03:00:00Z");
    const candidate = commitmentsForBooking("loc-a", "loc-a", start, end);
    expect(isWorkerScheduleFeasible([], candidate, baseSnapshot())).toBe(false);
  });

  it("rejects a return commitment that lands in the middle of the Malaysia night, even though its UTC clock time looks like a normal afternoon", () => {
    // 14:00-18:00 UTC looks like a perfectly ordinary daytime booking by UTC
    // clock time, but is actually 10pm-2am Malaysia time — the return
    // commitment falls after midnight, well before the next Malaysia day's
    // 7am floor. Anchoring the floor to UTC (or worse, the host machine's
    // own local time) instead of a fixed Malaysia offset misses this case
    // entirely — this is the exact bug a real booking attempt surfaced.
    const start = new Date("2026-09-08T14:00:00Z");
    const end = new Date("2026-09-08T18:00:00Z");
    const candidate = commitmentsForBooking("loc-a", "loc-a", start, end);
    expect(isWorkerScheduleFeasible([], candidate, baseSnapshot())).toBe(false);
  });

  it("allows back-to-back same-location commitments with zero gap", () => {
    // 01:00-05:00 UTC = 9am-1pm Malaysia time, leaving room for a second
    // same-day booking afterward without crossing into the next MYT day.
    const firstEnd = new Date("2026-09-10T05:00:00Z");
    const first = commitmentsForBooking("loc-a", "loc-a", new Date("2026-09-10T01:00:00Z"), firstEnd);
    // Second booking's setup starts exactly when the first's return window ends.
    const secondStart = new Date(firstEnd.getTime() + (10 + 15) * 60_000 + 15 * 60_000);
    const second = commitmentsForBooking("loc-a", "loc-a", secondStart, new Date(secondStart.getTime() + 4 * 60 * 60_000));
    expect(isWorkerScheduleFeasible(first, second, baseSnapshot())).toBe(true);
  });

  it("rejects two different-location commitments that overlap without enough travel buffer", () => {
    const first = commitmentsForBooking("loc-a", "loc-a", new Date("2026-09-10T01:00:00Z"), new Date("2026-09-10T05:00:00Z"));
    // loc-b setup needs to start right when loc-a's return window ends — but travel takes 15 min.
    const firstReturnEnd = first[1].end;
    const second = commitmentsForBooking("loc-b", "loc-b", new Date(firstReturnEnd.getTime() + 15 * 60_000), new Date(firstReturnEnd.getTime() + 4 * 60 * 60_000));
    expect(isWorkerScheduleFeasible(first, second, baseSnapshot())).toBe(false);
  });

  it("allows two different-location commitments with enough travel buffer", () => {
    const first = commitmentsForBooking("loc-a", "loc-a", new Date("2026-09-10T01:00:00Z"), new Date("2026-09-10T05:00:00Z"));
    const firstReturnEnd = first[1].end;
    // Give it the full 15min travel time as buffer this time.
    const secondStart = new Date(firstReturnEnd.getTime() + 15 * 60_000 + 15 * 60_000);
    const second = commitmentsForBooking("loc-b", "loc-b", secondStart, new Date(secondStart.getTime() + 4 * 60 * 60_000));
    expect(isWorkerScheduleFeasible(first, second, baseSnapshot())).toBe(true);
  });

  it("plans a one-way rental's own two commitments at different locations (pickup loc-a, dropoff loc-b) with enough travel buffer between them", () => {
    // Pickup setup at loc-a 01:00-05:00 UTC, dropoff return needs to be
    // reachable from loc-a with the 15min travel time factored in.
    const [setup, ret] = commitmentsForBooking(
      "loc-a",
      "loc-b",
      new Date("2026-09-10T01:00:00Z"),
      new Date("2026-09-10T05:00:00Z")
    );
    expect(setup.partnerId).toBe("loc-a");
    expect(ret.partnerId).toBe("loc-b");
    expect(isWorkerScheduleFeasible([], [setup, ret], baseSnapshot())).toBe(true);
  });

  it("rejects a one-way rental whose own pickup-to-dropoff travel isn't feasible", () => {
    // Setup at loc-a ending at 05:00, return at loc-b starting at 05:05 —
    // only 5 minutes to travel, but it takes 15.
    const setup: WorkerCommitment = { partnerId: "loc-a", start: new Date("2026-09-10T04:45:00Z"), end: new Date("2026-09-10T05:00:00Z") };
    const ret: WorkerCommitment = { partnerId: "loc-b", start: new Date("2026-09-10T05:05:00Z"), end: new Date("2026-09-10T05:30:00Z") };
    expect(isWorkerScheduleFeasible([], [setup, ret], baseSnapshot())).toBe(false);
  });
});

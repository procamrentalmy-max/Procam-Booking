import { describe, expect, it } from "vitest";
import { commitmentsForBooking, existingCommitments, isWorkerScheduleFeasible } from "./workerSchedule";
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
    const start = new Date("2026-09-10T10:00:00");
    const end = new Date("2026-09-10T14:00:00");
    const [setup, ret] = commitmentsForBooking("loc-a", start, end);

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
        { id: "b1", assetId: "cam-1", partnerId: "loc-a", status: "CONFIRMED", startTime: new Date("2026-09-10T10:00:00"), endTime: new Date("2026-09-10T14:00:00") },
        { id: "b2", assetId: "cam-2", partnerId: "loc-a", status: "CANCELLED", startTime: new Date("2026-09-10T10:00:00"), endTime: new Date("2026-09-10T14:00:00") },
      ],
    };
    expect(existingCommitments(snapshot)).toHaveLength(2); // 1 booking x 2 commitments
  });
});

describe("isWorkerScheduleFeasible", () => {
  it("allows a commitment on its own with no prior schedule", () => {
    const start = new Date("2026-09-10T10:00:00");
    const end = new Date("2026-09-10T14:00:00");
    const candidate = commitmentsForBooking("loc-a", start, end);
    expect(isWorkerScheduleFeasible([], candidate, baseSnapshot())).toBe(true);
  });

  it("rejects a commitment requiring presence before the worker's 7am start", () => {
    const start = new Date("2026-09-10T07:05:00"); // setup would need to start 06:50
    const end = new Date("2026-09-10T11:00:00");
    const candidate = commitmentsForBooking("loc-a", start, end);
    expect(isWorkerScheduleFeasible([], candidate, baseSnapshot())).toBe(false);
  });

  it("allows back-to-back same-location commitments with zero gap", () => {
    const firstEnd = new Date("2026-09-10T12:00:00");
    const first = commitmentsForBooking("loc-a", new Date("2026-09-10T08:00:00"), firstEnd);
    // Second booking's setup starts exactly when the first's return window ends.
    const secondStart = new Date(firstEnd.getTime() + (10 + 15) * 60_000 + 15 * 60_000);
    const second = commitmentsForBooking("loc-a", secondStart, new Date(secondStart.getTime() + 4 * 60 * 60_000));
    expect(isWorkerScheduleFeasible(first, second, baseSnapshot())).toBe(true);
  });

  it("rejects two different-location commitments that overlap without enough travel buffer", () => {
    const first = commitmentsForBooking("loc-a", new Date("2026-09-10T08:00:00"), new Date("2026-09-10T12:00:00"));
    // loc-b setup needs to start right when loc-a's return window ends — but travel takes 15 min.
    const firstReturnEnd = first[1].end;
    const second = commitmentsForBooking("loc-b", new Date(firstReturnEnd.getTime() + 15 * 60_000), new Date(firstReturnEnd.getTime() + 4 * 60 * 60_000));
    expect(isWorkerScheduleFeasible(first, second, baseSnapshot())).toBe(false);
  });

  it("allows two different-location commitments with enough travel buffer", () => {
    const first = commitmentsForBooking("loc-a", new Date("2026-09-10T08:00:00"), new Date("2026-09-10T12:00:00"));
    const firstReturnEnd = first[1].end;
    // Give it the full 15min travel time as buffer this time.
    const secondStart = new Date(firstReturnEnd.getTime() + 15 * 60_000 + 15 * 60_000);
    const second = commitmentsForBooking("loc-b", secondStart, new Date(secondStart.getTime() + 4 * 60 * 60_000));
    expect(isWorkerScheduleFeasible(first, second, baseSnapshot())).toBe(true);
  });
});

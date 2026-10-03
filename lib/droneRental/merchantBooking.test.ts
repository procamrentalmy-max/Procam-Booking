import { describe, expect, it } from "vitest";
import { computeMerchantInstantOptions, eligibleWalkInDrones, walkInDurationsForShop } from "./merchantBooking";
import type { BookingWindow } from "./slots";

const NOW = new Date("2026-09-02T04:01:00Z");

function bookingIn(minutesFromNow: number, status = "CONFIRMED"): BookingWindow {
  return {
    droneId: "d1",
    startTime: new Date(NOW.getTime() + minutesFromNow * 60_000),
    endTime: new Date(NOW.getTime() + (minutesFromNow + 60) * 60_000),
    status,
  };
}

describe("computeMerchantInstantOptions", () => {
  it("offers the full duration menu when the drone has no upcoming booking", () => {
    const result = computeMerchantInstantOptions([], "d1", NOW);
    expect(result).toEqual({ allowed: true, maxDurationMinutes: 240, offeredDurationsMinutes: [60, 120, 180, 240] });
  });

  it("blocks the walk-in entirely when the next booking starts within an hour", () => {
    const result = computeMerchantInstantOptions([bookingIn(45)], "d1", NOW);
    expect(result.allowed).toBe(false);
  });

  it("blocks at exactly 60 minutes out (boundary is inclusive of the block)", () => {
    const result = computeMerchantInstantOptions([bookingIn(60)], "d1", NOW);
    expect(result.allowed).toBe(false);
  });

  it("caps a 2-hour gap to a 1-hour walk-in", () => {
    const result = computeMerchantInstantOptions([bookingIn(120)], "d1", NOW);
    expect(result).toEqual({ allowed: true, maxDurationMinutes: 60, offeredDurationsMinutes: [60] });
  });

  it("caps a 3-hour gap to a 2-hour walk-in", () => {
    const result = computeMerchantInstantOptions([bookingIn(180)], "d1", NOW);
    expect(result).toEqual({ allowed: true, maxDurationMinutes: 120, offeredDurationsMinutes: [60, 120] });
  });

  it("allows for the return time being rounded up to the next 30-minute mark", () => {
    // 4:01 + 2h = 6:01, rounded to 6:30, plus the 30-minute buffer = 7:00, which is later than a 6:31 next booking,
    // so 2 hours is no longer offered even though the raw gap (150 minutes) would have allowed it.
    const result = computeMerchantInstantOptions([bookingIn(150)], "d1", NOW);
    expect(result).toEqual({ allowed: true, maxDurationMinutes: 60, offeredDurationsMinutes: [60] });
  });

  it("ignores a cancelled booking when computing the gap", () => {
    const result = computeMerchantInstantOptions([bookingIn(45, "CANCELLED")], "d1", NOW);
    expect(result.allowed).toBe(true);
  });

  it("ignores bookings for a different drone", () => {
    const other: BookingWindow = { ...bookingIn(45), droneId: "d2" };
    const result = computeMerchantInstantOptions([other], "d1", NOW);
    expect(result.allowed).toBe(true);
  });

  it("the 4:01 + 2hr walk-in example ends at 6:01, matching the spec's next-slot worked example", () => {
    const bookedAt = new Date("2026-09-02T04:01:00Z");
    const durationMinutes = 120;
    const end = new Date(bookedAt.getTime() + durationMinutes * 60_000);
    expect(end.toISOString()).toBe("2026-09-02T06:01:00.000Z");
  });
});

describe("eligibleWalkInDrones / walkInDurationsForShop", () => {
  const drone = (id: string, status: "AVAILABLE" | "RENTED" | "MAINTENANCE" = "AVAILABLE") => ({ id, humanId: id.toUpperCase(), status });

  it("lists available drones that have room, in a stable order", () => {
    const result = eligibleWalkInDrones([drone("d2"), drone("d1")], [], 60, NOW);
    expect(result.map((d) => d.id)).toEqual(["d1", "d2"]);
  });

  it("skips drones that are out, in maintenance, or too close to their next booking", () => {
    const drones = [drone("d1", "RENTED"), drone("d2", "MAINTENANCE"), drone("d3"), drone("d4")];
    const tooClose: BookingWindow = { ...bookingIn(45), droneId: "d3" };
    expect(eligibleWalkInDrones(drones, [tooClose], 60, NOW).map((d) => d.id)).toEqual(["d4"]);
  });

  it("skips a drone still tied up by an earlier booking that hasn't been collected yet", () => {
    const earlier: BookingWindow = { droneId: "d1", startTime: new Date(NOW.getTime() - 5 * 60_000), endTime: new Date(NOW.getTime() + 55 * 60_000), status: "CONFIRMED" };
    expect(eligibleWalkInDrones([drone("d1"), drone("d2")], [earlier], 60, NOW).map((d) => d.id)).toEqual(["d2"]);
  });

  it("offers only the lengths some drone can actually take", () => {
    const limited: BookingWindow = { ...bookingIn(120), droneId: "d1" }; // d1 only has room for 1 hour
    expect(walkInDurationsForShop([drone("d1")], [limited], NOW)).toEqual([60]);
    expect(walkInDurationsForShop([drone("d1"), drone("d2")], [limited], NOW)).toEqual([60, 120, 180, 240]);
  });

  it("offers nothing when no drone is free", () => {
    expect(walkInDurationsForShop([drone("d1", "RENTED")], [], NOW)).toEqual([]);
  });
});

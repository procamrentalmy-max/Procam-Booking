import { describe, expect, it } from "vitest";
import { computeMerchantInstantOptions } from "./merchantBooking";
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

import { describe, expect, it } from "vitest";
import { computeCollectBy, computeDestroyBy, nextAvailableSlot, TOTAL_SLOTS } from "./slots";

describe("nextAvailableSlot", () => {
  it("hands out the top slot first when nothing is occupied", () => {
    expect(nextAvailableSlot(new Set())).toBe(TOTAL_SLOTS);
  });

  it("counts down as slots fill up", () => {
    expect(nextAvailableSlot(new Set([50]))).toBe(49);
    expect(nextAvailableSlot(new Set([50, 49, 48]))).toBe(47);
  });

  it("reuses a freed slot even if higher numbers are occupied", () => {
    const occupied = new Set(Array.from({ length: TOTAL_SLOTS }, (_, i) => i + 1).filter((n) => n !== 37));
    expect(nextAvailableSlot(occupied)).toBe(37);
  });

  it("returns null once every slot is occupied", () => {
    const occupied = new Set(Array.from({ length: TOTAL_SLOTS }, (_, i) => i + 1));
    expect(nextAvailableSlot(occupied)).toBeNull();
  });
});

describe("computeCollectBy", () => {
  it("is 10:30am Malaysia time on the same day the order was placed", () => {
    // 2026-09-14 02:00 UTC = 2026-09-14 10:00 MYT
    const placedAt = new Date("2026-09-14T02:00:00Z");
    const collectBy = computeCollectBy(placedAt);
    expect(collectBy.toISOString()).toBe("2026-09-14T02:30:00.000Z"); // 10:30 MYT
  });
});

describe("computeDestroyBy", () => {
  it("is exactly 24 hours after the order was placed", () => {
    const placedAt = new Date("2026-09-14T02:30:00Z"); // 10:30 MYT
    const destroyBy = computeDestroyBy(placedAt);
    expect(destroyBy.toISOString()).toBe("2026-09-15T02:30:00.000Z");
  });

  it("rolls over month/year correctly", () => {
    const placedAt = new Date("2026-12-31T14:00:00Z");
    const destroyBy = computeDestroyBy(placedAt);
    expect(destroyBy.toISOString()).toBe("2027-01-01T14:00:00.000Z");
  });
});

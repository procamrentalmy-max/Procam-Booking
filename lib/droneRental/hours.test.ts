import { describe, expect, it } from "vitest";
import { generateDaySlots, isWithinOperatingHours, shopClosesAt, shopOpensAt, formatSlotTime, dayLabel } from "./hours";

// 2026-10-03 00:10 Malaysia time = 2026-10-02 16:10 UTC
const justAfterMidnight = new Date("2026-10-02T16:10:00Z");
// 2026-10-03 14:10 Malaysia time
const afternoon = new Date("2026-10-03T06:10:00Z");
// 2026-10-03 21:40 Malaysia time
const lateEvening = new Date("2026-10-03T13:40:00Z");

describe("shop hours in Malaysia time", () => {
  it("opens at 08:00 and closes at 22:00 MYT on the Malaysia day, whatever the UTC date", () => {
    expect(shopOpensAt(justAfterMidnight).toISOString()).toBe("2026-10-03T00:00:00.000Z");
    expect(shopClosesAt(justAfterMidnight).toISOString()).toBe("2026-10-03T14:00:00.000Z");
  });
});

describe("isWithinOperatingHours", () => {
  it("accepts a rental that ends exactly at closing", () => {
    expect(isWithinOperatingHours(new Date("2026-10-03T12:00:00Z"), 120)).toBe(true);
  });
  it("rejects one that runs past closing", () => {
    expect(isWithinOperatingHours(new Date("2026-10-03T13:30:00Z"), 60)).toBe(false);
  });
  it("rejects one that starts before opening", () => {
    expect(isWithinOperatingHours(new Date("2026-10-02T23:30:00Z"), 60)).toBe(false);
  });
});

describe("generateDaySlots", () => {
  it("starts at opening for today when it's before opening (just after midnight MYT)", () => {
    const slots = generateDaySlots(justAfterMidnight, 0, 60);
    expect(formatSlotTime(slots[0])).toBe("08:00");
  });

  it("ends with the last start that still finishes by closing", () => {
    const slots = generateDaySlots(justAfterMidnight, 0, 60);
    expect(formatSlotTime(slots[slots.length - 1])).toBe("21:00");
    const slots3h = generateDaySlots(justAfterMidnight, 0, 180);
    expect(formatSlotTime(slots3h[slots3h.length - 1])).toBe("19:00");
  });

  it("starts at the next 30-minute mark after now during the day", () => {
    expect(formatSlotTime(generateDaySlots(afternoon, 0, 60)[0])).toBe("14:30");
  });

  it("returns nothing for today once no start can still finish by closing", () => {
    expect(generateDaySlots(lateEvening, 0, 60)).toEqual([]);
  });

  it("gives a full day for tomorrow regardless of the time now", () => {
    const slots = generateDaySlots(lateEvening, 1, 60);
    expect(formatSlotTime(slots[0])).toBe("08:00");
    expect(slots).toHaveLength(27);
  });
});

describe("dayLabel", () => {
  it("names today and tomorrow, then dates", () => {
    expect(dayLabel(afternoon, 0)).toBe("Today");
    expect(dayLabel(afternoon, 1)).toBe("Tomorrow");
    expect(dayLabel(afternoon, 2)).toMatch(/Mon/);
  });
});

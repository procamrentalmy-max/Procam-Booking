import { describe, expect, it } from "vitest";
import { DEFAULT_SHOP_HOURS, dayLabel, describeDayHours, formatSlotTime, generateDaySlots, isOpenNow, isWithinOperatingHours, parseShopHours, serializeShopHours, shopClosesAt, shopOpensAt } from "./hours";

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

describe("each shop's own opening hours", () => {
  // Monday to Friday 09:00 to 18:00, Saturday 10:00 to 22:00, Sunday closed
  const hours = parseShopHours([null, ["09:00", "18:00"], ["09:00", "18:00"], ["09:00", "18:00"], ["09:00", "18:00"], ["09:00", "18:00"], ["10:00", "22:00"]]);
  const monday10 = new Date("2026-10-12T02:00:00Z"); // Mon 12 Oct 2026, 10:00 MYT
  const sunday10 = new Date("2026-10-11T02:00:00Z"); // Sun 11 Oct 2026, 10:00 MYT
  const saturday = new Date("2026-10-10T01:00:00Z"); // Sat 10 Oct 2026, 09:00 MYT

  it("opens and closes at each weekday's own time, and not at all on a closed day", () => {
    expect(shopOpensAt(monday10, hours)?.toISOString()).toBe("2026-10-12T01:00:00.000Z");
    expect(shopClosesAt(monday10, hours)?.toISOString()).toBe("2026-10-12T10:00:00.000Z");
    expect(shopOpensAt(sunday10, hours)).toBeNull();
    expect(shopClosesAt(sunday10, hours)).toBeNull();
    expect(shopOpensAt(saturday, hours)?.toISOString()).toBe("2026-10-10T02:00:00.000Z");
  });

  it("only accepts a rental that fits inside that day's hours", () => {
    expect(isWithinOperatingHours(monday10, 120, hours)).toBe(true);
    expect(isWithinOperatingHours(new Date("2026-10-12T09:00:00Z"), 120, hours)).toBe(false); // 17:00 MYT + 2 h runs past 18:00
    expect(isWithinOperatingHours(new Date("2026-10-12T00:30:00Z"), 60, hours)).toBe(false); // 08:30 MYT, before opening
    expect(isWithinOperatingHours(sunday10, 60, hours)).toBe(false);
  });

  it("offers slots from opening to the last start that ends by closing, none on a closed day", () => {
    const slots = generateDaySlots(new Date("2026-10-12T00:10:00Z"), 0, 60, hours);
    expect(formatSlotTime(slots[0])).toBe("09:00");
    expect(formatSlotTime(slots[slots.length - 1])).toBe("17:00");
    expect(generateDaySlots(new Date("2026-10-11T00:10:00Z"), 0, 60, hours)).toEqual([]);
  });

  it("knows when it is open right now", () => {
    expect(isOpenNow(hours, monday10)).toBe(true);
    expect(isOpenNow(hours, new Date("2026-10-12T10:30:00Z"))).toBe(false); // 18:30 MYT
    expect(isOpenNow(hours, sunday10)).toBe(false);
    expect(describeDayHours(hours, monday10)).toBe("09:00 to 18:00");
    expect(describeDayHours(hours, sunday10)).toBe("Closed");
  });

  it("falls back to the default 08:00 to 22:00 when nothing valid is stored, and never locks a day by accident", () => {
    expect(parseShopHours(null)).toEqual(DEFAULT_SHOP_HOURS);
    expect(parseShopHours([1, 2, 3])).toEqual(DEFAULT_SHOP_HOURS);
    const oneBad = parseShopHours([null, ["18:00", "09:00"], ["09:15", "18:00"], "x", ["09:00", "18:00"], ["09:00", "18:00"], ["09:00", "18:00"]]);
    expect(oneBad[0]).toBeNull();
    expect(oneBad[1]).toEqual({ open: "08:00", close: "22:00" }); // closing before opening
    expect(oneBad[2]).toEqual({ open: "08:00", close: "22:00" }); // not on the half hour
    expect(oneBad[3]).toEqual({ open: "08:00", close: "22:00" });
  });

  it("is stored and read back the same", () => {
    expect(parseShopHours(serializeShopHours(hours))).toEqual(hours);
  });
});

describe("renting by the day", () => {
  const day = 24 * 60;
  // 2026-10-05 is a Monday; 2026-10-03 (Saturday) 10:00 MYT = 02:00 UTC
  const saturday10 = new Date("2026-10-03T02:00:00Z");

  it("is picked up while the shop is open and brought back at the same time of day", () => {
    expect(isWithinOperatingHours(saturday10, day)).toBe(true);
    expect(isWithinOperatingHours(saturday10, 3 * day)).toBe(true);
    // 21:30 pickup (shop closes 22:00): back 21:30 on the last day
    expect(isWithinOperatingHours(new Date("2026-10-03T13:30:00Z"), day)).toBe(true);
  });

  it("is not picked up before opening or at closing time", () => {
    expect(isWithinOperatingHours(new Date("2026-10-02T23:30:00Z"), day)).toBe(false);
    expect(isWithinOperatingHours(new Date("2026-10-03T14:00:00Z"), day)).toBe(false);
  });

  it("needs the shop open at that time on the day it comes back", () => {
    const closedOnSunday = DEFAULT_SHOP_HOURS.map((d, i) => (i === 0 ? null : d));
    // Saturday 10:00 for 1 day = Sunday 10:00: closed
    expect(isWithinOperatingHours(saturday10, day, closedOnSunday)).toBe(false);
    expect(isWithinOperatingHours(saturday10, 2 * day, closedOnSunday)).toBe(true);
    // Shorter opening hours on the return day: back by 09:00 needs the shop to be open then
    const lateOpening = DEFAULT_SHOP_HOURS.map((d, i) => (i === 0 ? { open: "11:00", close: "18:00" } : d));
    expect(isWithinOperatingHours(saturday10, day, lateOpening)).toBe(false);
  });

  it("offers every half hour the shop is open as a pickup, the last half hour before closing included", () => {
    const slots = generateDaySlots(justAfterMidnight, 0, day);
    expect(formatSlotTime(slots[0])).toBe("08:00");
    expect(formatSlotTime(slots[slots.length - 1])).toBe("21:30");
  });

  it("offers no pickup when the shop is closed on the day it would come back", () => {
    const closedOnSunday = DEFAULT_SHOP_HOURS.map((d, i) => (i === 0 ? null : d));
    expect(generateDaySlots(justAfterMidnight, 0, day, closedOnSunday)).toEqual([]);
    expect(generateDaySlots(justAfterMidnight, 0, 2 * day, closedOnSunday).length).toBeGreaterThan(0);
  });
});

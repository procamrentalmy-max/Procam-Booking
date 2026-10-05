import { describe, expect, it } from "vitest";
import { formatDuration, formatClock, formatDayLabel, describeDue, pickupDay, batteryLabel } from "./format";

describe("formatDuration", () => {
  it("shows minutes under an hour", () => {
    expect(formatDuration(42 * 60_000)).toBe("42 min");
  });
  it("shows whole hours without a minutes part", () => {
    expect(formatDuration(3 * 60 * 60_000)).toBe("3h");
  });
  it("shows hours and minutes together", () => {
    expect(formatDuration((3 * 60 + 12) * 60_000)).toBe("3h 12m");
  });
  it("says under 1 min for tiny or negative spans", () => {
    expect(formatDuration(20_000)).toBe("under 1 min");
    expect(formatDuration(-5_000)).toBe("under 1 min");
  });
});

describe("formatClock", () => {
  it("renders Malaysia time (UTC+8) regardless of the server's timezone", () => {
    expect(formatClock(new Date("2026-10-02T11:30:00Z"))).toBe("19:30");
    expect(formatClock(new Date("2026-10-02T16:05:00Z"))).toBe("00:05");
  });
});

describe("formatDayLabel", () => {
  const now = new Date("2026-10-02T11:30:00Z"); // 19:30 on 2 Oct, Malaysia
  it("says Today for the same Malaysia calendar day", () => {
    expect(formatDayLabel(new Date("2026-10-02T14:00:00Z"), now)).toBe("Today");
  });
  it("uses Malaysia's calendar day, not UTC's — 17:00Z is already tomorrow in Malaysia", () => {
    expect(formatDayLabel(new Date("2026-10-02T17:00:00Z"), now)).toBe("Tomorrow");
  });
  it("falls back to a date for anything later", () => {
    expect(formatDayLabel(new Date("2026-10-05T04:00:00Z"), now)).toBe("05 Oct");
  });
});

describe("describeDue", () => {
  const now = new Date("2026-10-02T12:00:00Z");
  it("counts down before the return time", () => {
    expect(describeDue(new Date("2026-10-02T12:42:00Z"), now)).toEqual({ label: "42 min left", overdue: false });
  });
  it("flags overdue after it", () => {
    expect(describeDue(new Date("2026-10-02T11:48:00Z"), now)).toEqual({ label: "12 min overdue", overdue: true });
  });
});

describe("pickupDay", () => {
  const now = new Date("2026-10-02T11:30:00Z"); // 19:30 on Fri 2 Oct, Malaysia

  it("is today for any time on the same Malaysia calendar day", () => {
    expect(pickupDay(new Date("2026-10-02T00:00:00Z"), now)).toBe("today"); // 08:00 this morning, already past
    expect(pickupDay(new Date("2026-10-02T15:59:00Z"), now)).toBe("today"); // 23:59
  });

  it("is tomorrow from Malaysia midnight until the following midnight", () => {
    expect(pickupDay(new Date("2026-10-02T16:00:00Z"), now)).toBe("tomorrow"); // 00:00 on 3 Oct
    expect(pickupDay(new Date("2026-10-03T15:59:00Z"), now)).toBe("tomorrow"); // 23:59 on 3 Oct
  });

  it("is null for the day after tomorrow and for any earlier day", () => {
    expect(pickupDay(new Date("2026-10-03T16:00:00Z"), now)).toBeNull(); // 00:00 on 4 Oct
    expect(pickupDay(new Date("2026-10-01T15:59:00Z"), now)).toBeNull(); // 23:59 on 1 Oct
    expect(pickupDay(new Date("2026-09-20T05:00:00Z"), now)).toBeNull();
  });

  it("counts days in Malaysia, not UTC: 22:00 UTC is already tomorrow there", () => {
    const lateUtc = new Date("2026-10-02T22:00:00Z"); // 06:00 on 3 Oct in Malaysia
    expect(pickupDay(lateUtc, now)).toBe("tomorrow");
  });
});

describe("batteryLabel", () => {
  it("uses the sticker name when there is one", () => {
    expect(batteryLabel({ name: "DRN-001-B", human_id: "DBAT-002" })).toBe("DRN-001-B");
  });
  it("falls back to the id when the battery has no name or a blank one", () => {
    expect(batteryLabel({ name: null, human_id: "DBAT-002" })).toBe("DBAT-002");
    expect(batteryLabel({ name: "  ", human_id: "DBAT-002" })).toBe("DBAT-002");
  });
});

import { describe, expect, it } from "vitest";
import { computeHandoverWindow } from "./handover";

const created = new Date("2026-10-03T04:00:00Z");
const reservedEnd = new Date("2026-10-03T05:00:00Z"); // a 1-hour walk-in, reserved from creation
const at = (hhmm: string) => new Date(`2026-10-03T${hhmm}:00Z`);
const walkIn = { source: "MERCHANT_INSTANT" as const, start: created, end: reservedEnd };

describe("computeHandoverWindow", () => {
  it("leaves an online booking exactly as booked", () => {
    const w = computeHandoverWindow({ source: "ONLINE", start: created, end: reservedEnd, handoverAt: at("04:20"), nextStart: null });
    expect(w).toEqual({ start: created, end: reservedEnd, shortenedByMinutes: 0 });
  });

  it("starts a walk-in at handover and rounds the return time up to the next 30-minute mark", () => {
    const w = computeHandoverWindow({ ...walkIn, handoverAt: at("04:12"), nextStart: null });
    expect(w.start).toEqual(at("04:12"));
    expect(w.end).toEqual(at("05:30")); // 04:12 + 1h = 05:12 -> 05:30
    expect(w.shortenedByMinutes).toBe(0);
  });

  it("leaves a return time that already lands on a 30-minute mark alone", () => {
    const w = computeHandoverWindow({ ...walkIn, handoverAt: at("04:30"), nextStart: null });
    expect(w.end).toEqual(at("05:30"));
  });

  it("rounds a just-past-the-mark return up a full step", () => {
    const w = computeHandoverWindow({ ...walkIn, handoverAt: at("04:31"), nextStart: null });
    expect(w.end).toEqual(at("06:00")); // 05:31 -> 06:00
  });

  it("treats an instantaneous handover as no change", () => {
    const w = computeHandoverWindow({ ...walkIn, handoverAt: created, nextStart: null });
    expect(w).toEqual({ start: created, end: reservedEnd, shortenedByMinutes: 0 });
  });

  it("keeps the rounded return when there's room before the next booking", () => {
    const w = computeHandoverWindow({ ...walkIn, handoverAt: at("04:15"), nextStart: at("07:00") });
    expect(w.end).toEqual(at("05:30"));
    expect(w.shortenedByMinutes).toBe(0);
  });

  it("trims only the rounding (no one loses paid time) when the next booking is a little too close", () => {
    // handover 04:20 -> paid until 05:20, rounded 05:30; next booking 06:00 -> latest end 05:30 -> fits exactly
    const w1 = computeHandoverWindow({ ...walkIn, handoverAt: at("04:20"), nextStart: at("06:00") });
    expect(w1.end).toEqual(at("05:30"));
    // next booking 05:55 -> latest end 05:25: cut the rounding back, still past the paid 05:20
    const w2 = computeHandoverWindow({ ...walkIn, handoverAt: at("04:20"), nextStart: at("05:55") });
    expect(w2.end).toEqual(at("05:25"));
    expect(w2.shortenedByMinutes).toBe(0);
  });

  it("cuts into paid time only when it must, and reports by how much", () => {
    // handover 04:20 -> paid until 05:20; next booking 05:30 -> latest end 05:00
    const w = computeHandoverWindow({ ...walkIn, handoverAt: at("04:20"), nextStart: at("05:30") });
    expect(w.end).toEqual(at("05:00"));
    expect(w.shortenedByMinutes).toBe(20);
  });

  it("never ends earlier than what was reserved", () => {
    const w = computeHandoverWindow({ ...walkIn, handoverAt: at("04:50"), nextStart: at("05:20") });
    expect(w.end).toEqual(reservedEnd);
  });
});

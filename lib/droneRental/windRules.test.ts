import { describe, expect, it } from "vitest";
import { formatWind, isTooWindy, maxWindForWindow, windLimitFor, type WindForecast } from "./windRules";

const at = (hhmm: string) => new Date(`2026-10-07T${hhmm}:00.000Z`);
const forecast = (hours: Record<string, number>, currentMps: number | null = null): WindForecast => ({
  currentMps,
  hours: Object.entries(hours).map(([t, windMps]) => ({ start: at(t), windMps })),
});

describe("wind limits", () => {
  it("is the drone's own wind resistance: 10.7 m/s for the Neo 2, 8 m/s for the Neo", () => {
    expect(windLimitFor("NEO2")).toBe(10.7);
    expect(windLimitFor("NEO")).toBe(8);
  });

  it("only blocks wind stronger than the limit; exactly at it is fine", () => {
    expect(isTooWindy("NEO2", 10.7)).toBe(false);
    expect(isTooWindy("NEO2", 10.8)).toBe(true);
    expect(isTooWindy("NEO", 8.5)).toBe(true);
    expect(isTooWindy("NEO2", 8.5)).toBe(false);
  });

  it("never blocks when the wind isn't known, or the drone has no limit", () => {
    expect(isTooWindy("NEO2", null)).toBe(false);
    expect(isTooWindy("GT50", 30)).toBe(false);
  });
});

describe("maxWindForWindow", () => {
  const f = forecast({ "09:00": 4, "10:00": 6, "11:00": 12, "12:00": 5 });

  it("takes the strongest hour the rental overlaps", () => {
    expect(maxWindForWindow(f, at("09:00"), at("11:00"), at("08:00"))).toBe(6);
    expect(maxWindForWindow(f, at("10:30"), at("11:30"), at("08:00"))).toBe(12);
  });

  it("doesn't count an hour that only touches the rental", () => {
    expect(maxWindForWindow(f, at("09:00"), at("11:00"), at("08:00"))).toBe(6);
    expect(maxWindForWindow(f, at("12:00"), at("13:00"), at("08:00"))).toBe(5);
  });

  it("uses the live reading too when the rental starts now", () => {
    const live = forecast({ "10:00": 4 }, 11);
    expect(maxWindForWindow(live, at("10:00"), at("11:00"), at("10:10"))).toBe(11);
    // A rental later today ignores the live reading.
    expect(maxWindForWindow(live, at("14:00"), at("15:00"), at("10:10"))).toBeNull();
  });

  it("is null with nothing to go on", () => {
    expect(maxWindForWindow(forecast({}), at("10:00"), at("11:00"), at("08:00"))).toBeNull();
  });
});

describe("formatWind", () => {
  it("shows one decimal at most", () => {
    expect(formatWind(10.7)).toBe("10.7 m/s");
    expect(formatWind(8)).toBe("8 m/s");
    expect(formatWind(11.234)).toBe("11.2 m/s");
  });
});

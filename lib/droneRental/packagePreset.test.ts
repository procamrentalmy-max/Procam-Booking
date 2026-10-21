import { describe, expect, it, vi } from "vitest";

// These tests are about how renting by the day works, so they run with it switched on (lib/features.ts has it off for now; dailyOff.test.ts covers the off state).
vi.mock("@/lib/features", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/features")>()), DAILY_RENTAL_ENABLED: true }));
import { packageQuery, parsePackagePreset } from "./packagePreset";

describe("package carried from the landing page", () => {
  it("reads a real package", () => {
    expect(parsePackagePreset({ drone: "NEO2", fly: "RC_N3", batteries: "2", hours: "3" })).toEqual({ model: "NEO2", controller: "RC_N3", batteries: 2, minutes: 180 });
    expect(parsePackagePreset({ drone: "NEO", fly: "NONE", batteries: "1", hours: "1" })).toEqual({ model: "NEO", controller: "NONE", batteries: 1, minutes: 60 });
  });

  it("round-trips through the address", () => {
    const p = { model: "NEO2", controller: "GOGGLES_N3", batteries: 1, minutes: 360 } as const;
    expect(parsePackagePreset(Object.fromEntries(new URLSearchParams(packageQuery(p))))).toEqual(p);
  });

  it("reads a daily package, which needs no battery choice", () => {
    expect(parsePackagePreset({ drone: "NEO2", fly: "RC_N3", days: "2" })).toEqual({ model: "NEO2", controller: "RC_N3", batteries: 2, minutes: 2 * 1440 });
    const p = { model: "NEO2", controller: "NONE", batteries: 2, minutes: 3 * 1440 } as const;
    expect(packageQuery(p)).toContain("days=3");
    expect(parsePackagePreset(Object.fromEntries(new URLSearchParams(packageQuery(p))))).toEqual(p);
  });

  it("ignores a daily package that is not offered: 4 days, 0 days, or the goggles set", () => {
    expect(parsePackagePreset({ drone: "NEO2", fly: "NONE", days: "4" })).toBeNull();
    expect(parsePackagePreset({ drone: "NEO2", fly: "NONE", days: "0" })).toBeNull();
    expect(parsePackagePreset({ drone: "NEO2", fly: "NONE", days: "1.5" })).toBeNull();
    expect(parsePackagePreset({ drone: "NEO2", fly: "GOGGLES_N3", days: "1" })).toBeNull();
  });

  it("ignores anything that is not a real combination", () => {
    expect(parsePackagePreset({})).toBeNull();
    expect(parsePackagePreset({ drone: "GT50", fly: "RC_N3", batteries: "1", hours: "1" })).toBeNull(); // parked drone
    expect(parsePackagePreset({ drone: "NEO2", fly: "JETPACK", batteries: "1", hours: "1" })).toBeNull();
    expect(parsePackagePreset({ drone: "NEO2", fly: "NONE", batteries: "3", hours: "1" })).toBeNull();
    expect(parsePackagePreset({ drone: "NEO2", fly: "NONE", batteries: "1", hours: "0" })).toBeNull();
    expect(parsePackagePreset({ drone: "NEO2", fly: "NONE", batteries: "1", hours: "7" })).toBeNull();
    expect(parsePackagePreset({ drone: "NEO2", fly: "NONE", batteries: "1", hours: "1.5" })).toBeNull();
  });

  it("takes the first value when a parameter is repeated", () => {
    expect(parsePackagePreset({ drone: ["NEO", "NEO2"], fly: "NONE", batteries: "2", hours: "2" })?.model).toBe("NEO");
  });
});

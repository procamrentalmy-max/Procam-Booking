import { describe, expect, it } from "vitest";
import { packageQuery, parsePackagePreset } from "./packagePreset";

describe("package carried from the landing page", () => {
  it("reads a real package", () => {
    expect(parsePackagePreset({ drone: "NEO2", fly: "RC_N3", batteries: "2", hours: "3" })).toEqual({ model: "NEO2", controller: "RC_N3", batteries: 2, hours: 3 });
    expect(parsePackagePreset({ drone: "NEO", fly: "NONE", batteries: "1", hours: "1" })).toEqual({ model: "NEO", controller: "NONE", batteries: 1, hours: 1 });
  });

  it("round-trips through the address", () => {
    const p = { model: "NEO2", controller: "GOGGLES_N3", batteries: 1, hours: 6 } as const;
    expect(parsePackagePreset(Object.fromEntries(new URLSearchParams(packageQuery(p))))).toEqual(p);
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

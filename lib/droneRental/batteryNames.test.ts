import { describe, expect, it } from "vitest";
import { nextBatteryNames } from "./batteryNames";

describe("nextBatteryNames", () => {
  it("starts at B1 for a shop with no batteries", () => {
    expect(nextBatteryNames([], 3)).toEqual(["B1", "B2", "B3"]);
  });

  it("carries on after the highest number in the shop", () => {
    expect(nextBatteryNames(["B1", "B2", "B3"], 3)).toEqual(["B4", "B5", "B6"]);
    expect(nextBatteryNames(["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9"], 3)).toEqual(["B10", "B11", "B12"]);
  });

  it("goes after the highest, not into gaps", () => {
    expect(nextBatteryNames(["B1", "B5"], 2)).toEqual(["B6", "B7"]);
  });

  it("ignores batteries the admin renamed to something else, and blanks", () => {
    expect(nextBatteryNames(["B2", "Spare", null, "  ", "DRN-001-A"], 1)).toEqual(["B3"]);
  });

  it("numbers each letter on its own: GT50 batteries are A1, A2, ... and don't affect the B series", () => {
    expect(nextBatteryNames(["B1", "B2", "B3"], 3, "A")).toEqual(["A1", "A2", "A3"]);
    expect(nextBatteryNames(["B1", "A1", "A2"], 2, "A")).toEqual(["A3", "A4"]);
    expect(nextBatteryNames(["B1", "A1", "A2"], 1, "B")).toEqual(["B2"]);
  });

  it("reads the number case-insensitively and with stray spaces", () => {
    expect(nextBatteryNames(["b4", " B6 "], 1)).toEqual(["B7"]);
  });
});

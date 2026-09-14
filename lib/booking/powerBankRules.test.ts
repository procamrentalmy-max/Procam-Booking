import { describe, expect, it } from "vitest";
import { packageNeedsPowerBank } from "./powerBankRules";

describe("packageNeedsPowerBank", () => {
  it("is false under 3 hours even for the drone", () => {
    expect(packageNeedsPowerBank("dji-neo-2-mini-drone", 60)).toBe(false);
    expect(packageNeedsPowerBank("dji-neo-2-mini-drone", 120)).toBe(false);
  });

  it("is true at exactly 3 hours and beyond for the drone", () => {
    expect(packageNeedsPowerBank("dji-neo-2-mini-drone", 180)).toBe(true);
    expect(packageNeedsPowerBank("dji-neo-2-mini-drone", 1440)).toBe(true);
    expect(packageNeedsPowerBank("dji-neo-2-mini-drone", 7200)).toBe(true);
  });

  it("is false for every other product regardless of duration", () => {
    expect(packageNeedsPowerBank("insta360-adventure-camera", 1440)).toBe(false);
    expect(packageNeedsPowerBank("sealife-sportdiver-ultra", 1440)).toBe(false);
  });
});

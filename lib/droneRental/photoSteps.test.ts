import { describe, expect, it } from "vitest";
import { dronePhotoSteps } from "./photoSteps";

describe("dronePhotoSteps", () => {
  it("has the same seven steps, in the same order, for handover and return", () => {
    const pickup = dronePhotoSteps(2, "pickup").map((s) => s.key);
    const ret = dronePhotoSteps(2, "return").map((s) => s.key);
    expect(pickup).toEqual(["power_on", "front", "top", "underside", "controller", "batteries", "kit_full"]);
    expect(ret).toEqual(pickup);
  });

  it("gives every step a unique key, a label and an instruction", () => {
    const steps = dronePhotoSteps(1, "pickup");
    expect(new Set(steps.map((s) => s.key)).size).toBe(steps.length);
    for (const s of steps) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.instruction.length).toBeGreaterThan(10);
    }
  });

  it("words the battery steps for one battery", () => {
    const steps = dronePhotoSteps(1, "pickup");
    expect(steps.find((s) => s.key === "batteries")).toMatchObject({ label: "Battery", instruction: "Photograph the battery being handed over." });
    expect(steps.find((s) => s.key === "kit_full")?.instruction).toContain("the battery together");
  });

  it("words the battery steps for two batteries, and for return", () => {
    const steps = dronePhotoSteps(2, "return");
    expect(steps.find((s) => s.key === "batteries")).toMatchObject({ label: "Batteries" });
    expect(steps.find((s) => s.key === "batteries")?.instruction).toContain("2 batteries being returned");
  });
});

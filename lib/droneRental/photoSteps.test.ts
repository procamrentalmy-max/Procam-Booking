import { describe, expect, it } from "vitest";
import { dronePhotoSteps } from "./photoSteps";
import { DRONE_MODEL_PROFILES } from "./pricingRules";

const NEO = DRONE_MODEL_PROFILES.NEO2;
const GT = DRONE_MODEL_PROFILES.GT50;

describe("dronePhotoSteps", () => {
  it("is two photos, in this order: drone and controller both on, then front and camera", () => {
    expect(dronePhotoSteps(NEO).map((s) => s.key)).toEqual(["drone_and_controller", "front"]);
  });

  it("gives every step a unique key, a label and an instruction", () => {
    const steps = dronePhotoSteps(NEO);
    expect(new Set(steps.map((s) => s.key)).size).toBe(steps.length);
    for (const s of steps) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.instruction.length).toBeGreaterThan(10);
    }
  });

  it("asks for the drone from above with the controller, both switched on", () => {
    const first = dronePhotoSteps(NEO)[0];
    expect(first.label).toBe("Drone and controller, both on");
    expect(first.instruction).toContain("from above");
    expect(first.instruction).toContain("controller");
  });

  it("names the RC-N3 for the Neo 2 and just 'the controller' for the GT50, with the same two photos", () => {
    expect(dronePhotoSteps(NEO)[0].instruction).toContain("the RC-N3 controller ON");
    expect(dronePhotoSteps(GT)[0].instruction).toContain("the controller ON");
    expect(dronePhotoSteps(GT)[0].instruction).not.toContain("RC-N3");
    expect(dronePhotoSteps(GT).map((x) => x.key)).toEqual(dronePhotoSteps(NEO).map((x) => x.key));
  });

  it("photographs just the drone, switched on, when the controller isn't rented, with the same two photos and keys", () => {
    const steps = dronePhotoSteps(NEO, false);
    expect(steps.map((x) => x.key)).toEqual(["drone_and_controller", "front"]);
    expect(steps[0].label).toBe("Drone, on");
    expect(steps[0].instruction).not.toContain("controller");
  });
});

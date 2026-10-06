import { describe, expect, it } from "vitest";
import { dronePhotoSteps } from "./photoSteps";

describe("dronePhotoSteps", () => {
  it("is two photos, in this order: drone and controller both on, then front and camera", () => {
    expect(dronePhotoSteps("NEO2").map((s) => s.key)).toEqual(["drone_and_controller", "front"]);
  });

  it("gives every step a unique key, a label and an instruction, for every drone and every way of flying it", () => {
    for (const model of ["NEO2", "NEO", "GT50"]) {
      for (const kind of ["NONE", "RC_N3", "GOGGLES_N3"] as const) {
        const steps = dronePhotoSteps(model, kind);
        expect(new Set(steps.map((s) => s.key)).size).toBe(steps.length);
        for (const s of steps) {
          expect(s.label.length).toBeGreaterThan(0);
          expect(s.instruction.length).toBeGreaterThan(10);
        }
      }
    }
  });

  it("asks for the drone from above with the controller, both switched on", () => {
    const first = dronePhotoSteps("NEO2")[0];
    expect(first.label).toBe("Drone and controller, both on");
    expect(first.instruction).toContain("from above");
    expect(first.instruction).toContain("controller");
  });

  it("names the RC-N3 for the Neo and the Neo 2 and just 'the controller' for the GT50, with the same two photos", () => {
    expect(dronePhotoSteps("NEO2")[0].instruction).toContain("the RC-N3 controller ON");
    expect(dronePhotoSteps("NEO")[0].instruction).toContain("the RC-N3 controller ON");
    expect(dronePhotoSteps("GT50")[0].instruction).toContain("the controller ON");
    expect(dronePhotoSteps("GT50")[0].instruction).not.toContain("RC-N3");
    expect(dronePhotoSteps("GT50").map((x) => x.key)).toEqual(dronePhotoSteps("NEO2").map((x) => x.key));
  });

  it("photographs the drone with the goggles and the Motion 3 controller for the goggles set, with the same two keys", () => {
    const steps = dronePhotoSteps("NEO2", "GOGGLES_N3");
    expect(steps.map((x) => x.key)).toEqual(["drone_and_controller", "front"]);
    expect(steps[0].label).toBe("Drone and goggles set, all on");
    expect(steps[0].instruction).toContain("Goggles N3");
    expect(steps[0].instruction).toContain("Motion 3");
  });

  it("photographs just the drone, switched on, when no controller is rented, with the same two photos and keys", () => {
    const steps = dronePhotoSteps("NEO2", "NONE");
    expect(steps.map((x) => x.key)).toEqual(["drone_and_controller", "front"]);
    expect(steps[0].label).toBe("Drone, on");
    expect(steps[0].instruction).not.toContain("controller");
  });
});

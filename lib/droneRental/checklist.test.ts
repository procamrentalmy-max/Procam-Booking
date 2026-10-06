import { describe, expect, it } from "vitest";
import { checklistForRental, POWERS_ON_WITH_GOGGLES_LABEL, POWERS_ON_WITHOUT_CONTROLLER_LABEL } from "./checklist";

const neo = [
  { item_key: "powers_on", label: "Drone powers on and connects to the RC-N3 controller" },
  { item_key: "propellers_intact", label: "All 4 propellers/prop guards are undamaged" },
  { item_key: "body_undamaged", label: "Body and gimbal/camera show no visible damage" },
  { item_key: "batteries_present", label: "All the batteries handed out are present" },
  { item_key: "controller_present", label: "RC-N3 controller is present and working" },
];

const goggles = { item_key: "goggles_present", label: "Goggles N3 and Motion 3 controller are present and working" };
const withGoggles = [...neo, goggles];

describe("checklistForRental", () => {
  it("is the RC-N3's list when the RC-N3 goes out (and the goggles item is left out)", () => {
    expect(checklistForRental(withGoggles, "RC_N3")).toEqual(neo);
  });

  it("drops the controller item and points the power-on item at the phone when no controller goes out", () => {
    const list = checklistForRental(withGoggles, "NONE");
    expect(list.map((i) => i.item_key)).toEqual(["powers_on", "propellers_intact", "body_undamaged", "batteries_present"]);
    expect(list[0].label).toBe(POWERS_ON_WITHOUT_CONTROLLER_LABEL);
    expect(list[1].label).toBe(neo[1].label);
  });

  it("swaps the RC-N3 item for the goggles item and points the power-on item at the goggles for the goggles set", () => {
    const list = checklistForRental(withGoggles, "GOGGLES_N3");
    expect(list.map((i) => i.item_key)).toEqual(["powers_on", "propellers_intact", "body_undamaged", "batteries_present", "goggles_present"]);
    expect(list[0].label).toBe(POWERS_ON_WITH_GOGGLES_LABEL);
  });

  it("works on just the keys (what the server checks)", () => {
    const keys = (kind: "NONE" | "RC_N3" | "GOGGLES_N3") => checklistForRental(withGoggles.map(({ item_key }) => ({ item_key })), kind).map((i) => i.item_key);
    expect(keys("NONE")).toEqual(["powers_on", "propellers_intact", "body_undamaged", "batteries_present"]);
    expect(keys("RC_N3")).toContain("controller_present");
    expect(keys("RC_N3")).not.toContain("goggles_present");
    expect(keys("GOGGLES_N3")).toContain("goggles_present");
    expect(keys("GOGGLES_N3")).not.toContain("controller_present");
  });
});

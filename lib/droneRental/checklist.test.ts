import { describe, expect, it } from "vitest";
import { checklistForRental, POWERS_ON_WITHOUT_CONTROLLER_LABEL } from "./checklist";

const neo = [
  { item_key: "powers_on", label: "Drone powers on and connects to the RC-N3 controller" },
  { item_key: "propellers_intact", label: "All 4 propellers/prop guards are undamaged" },
  { item_key: "body_undamaged", label: "Body and gimbal/camera show no visible damage" },
  { item_key: "batteries_present", label: "All the batteries handed out are present" },
  { item_key: "controller_present", label: "RC-N3 controller is present and working" },
];

describe("checklistForRental", () => {
  it("is the whole list when the controller goes out", () => {
    expect(checklistForRental(neo, true)).toEqual(neo);
  });

  it("drops the controller item and points the power-on item at the phone when it doesn't", () => {
    const list = checklistForRental(neo, false);
    expect(list.map((i) => i.item_key)).toEqual(["powers_on", "propellers_intact", "body_undamaged", "batteries_present"]);
    expect(list[0].label).toBe(POWERS_ON_WITHOUT_CONTROLLER_LABEL);
    expect(list[1].label).toBe(neo[1].label);
  });

  it("works on just the keys (what the server checks), dropping the controller item", () => {
    const keys = checklistForRental(neo.map(({ item_key }) => ({ item_key })), false).map((i) => i.item_key);
    expect(keys).toEqual(["powers_on", "propellers_intact", "body_undamaged", "batteries_present"]);
  });
});

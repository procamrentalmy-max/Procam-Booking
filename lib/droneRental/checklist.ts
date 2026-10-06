import { DEFAULT_CONTROLLER, type ControllerKind } from "./pricingRules";

/** The checklist items about the RC-N3 controller, which a rental with anything else leaves out. */
const RC_CONTROLLER_ITEMS = new Set(["controller_present", "gt50_controller"]);
/** The checklist item about the goggles set, which only a rental with the goggles set has. */
const GOGGLES_ITEMS = new Set(["goggles_present"]);
/** The "drone powers on and connects to the controller" items, which say what it connects to depending on the rental. */
const POWERS_ON_ITEMS = new Set(["powers_on", "gt50_powers_on"]);

export const POWERS_ON_WITHOUT_CONTROLLER_LABEL = "Drone powers on and connects to the customer's phone";
export const POWERS_ON_WITH_GOGGLES_LABEL = "Drone powers on and connects to the goggles";

/**
 * The handover / return checklist for one rental: the model's list, with only the item for the controller that actually
 * goes out (none, the RC-N3, or the goggles set) and the power-on item saying what the drone connects to. Used to draw the
 * checklist and to check it was ticked, so the two always agree.
 */
export function checklistForRental<T extends { item_key: string; label?: string }>(items: T[], controller: ControllerKind = DEFAULT_CONTROLLER): T[] {
  return items
    .filter((item) => {
      if (RC_CONTROLLER_ITEMS.has(item.item_key)) return controller === "RC_N3";
      if (GOGGLES_ITEMS.has(item.item_key)) return controller === "GOGGLES_N3";
      return true;
    })
    .map((item) => {
      if (!POWERS_ON_ITEMS.has(item.item_key) || item.label === undefined) return item;
      if (controller === "NONE") return { ...item, label: POWERS_ON_WITHOUT_CONTROLLER_LABEL };
      if (controller === "GOGGLES_N3") return { ...item, label: POWERS_ON_WITH_GOGGLES_LABEL };
      return item;
    });
}

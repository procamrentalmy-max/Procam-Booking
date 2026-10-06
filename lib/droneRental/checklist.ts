/** The checklist items about the controller, which a rental without the controller leaves out. */
const CONTROLLER_ONLY_ITEMS = new Set(["controller_present", "gt50_controller"]);
/** The "drone powers on and connects to the controller" items, which for a rental without the controller connect to the customer's phone instead. */
const POWERS_ON_ITEMS = new Set(["powers_on", "gt50_powers_on"]);

export const POWERS_ON_WITHOUT_CONTROLLER_LABEL = "Drone powers on and connects to the customer's phone";

/**
 * The handover / return checklist for one rental: the model's list, without the controller item (and with the
 * power-on item pointing at the phone) when the controller isn't part of it. Used to draw the checklist and to check it
 * was ticked, so the two always agree.
 */
export function checklistForRental<T extends { item_key: string; label?: string }>(items: T[], withController: boolean): T[] {
  if (withController) return items;
  return items
    .filter((item) => !CONTROLLER_ONLY_ITEMS.has(item.item_key))
    .map((item) => (POWERS_ON_ITEMS.has(item.item_key) && item.label !== undefined ? { ...item, label: POWERS_ON_WITHOUT_CONTROLLER_LABEL } : item));
}

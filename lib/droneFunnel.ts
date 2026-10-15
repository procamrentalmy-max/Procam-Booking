/** The steps of the drone booking flow, in order, for the drop-off funnel (Admin > Drone Funnel). Shared by the browser and the admin page. */
export const DRONE_FUNNEL_STEPS = [
  { key: "HOME", label: "Home page" },
  { key: "PRICE", label: "Picked a package on the home page" },
  { key: "SHOPS", label: "Shop list" },
  { key: "PACKAGE", label: "Booking page: drone, how to fly, batteries" },
  { key: "TIME", label: "Booking page: day and time" },
  { key: "DETAILS", label: "Booking page: their details" },
  { key: "ID_CHECK", label: "Tapped Book and pay (ID check starts)" },
  { key: "PAY", label: "Payment page" },
  { key: "PAID", label: "Paid" },
] as const;

export type DroneFunnelStep = (typeof DRONE_FUNNEL_STEPS)[number]["key"];
export const DRONE_FUNNEL_KEYS: readonly string[] = DRONE_FUNNEL_STEPS.map((s) => s.key);
export const FUNNEL_SESSION_KEY = "procam_funnel_sid";
export const FUNNEL_PAYING_KEY = "procam_funnel_paying";

import { DRONE_ID_CHECK_ENABLED } from "@/lib/features";

/** The steps of the drone booking flow, in order, for the drop-off funnel (Admin > Drone Funnel). Shared by the browser and the admin page. */
export const DRONE_FUNNEL_STEPS = [
  { key: "HOME", label: "Home page" },
  { key: "PRICE", label: "Picked a package on the home page" },
  { key: "SHOPS", label: "Shop list" },
  { key: "PACKAGE", label: "Booking page: drone, how to fly, batteries" },
  { key: "TIME", label: "Booking page: day and time" },
  { key: "DETAILS", label: "Booking page: their details" },
  { key: "ID_CHECK", label: DRONE_ID_CHECK_ENABLED ? "Tapped Book and pay (ID check starts)" : "Tapped Book and pay" },
  { key: "PAY", label: "Payment page" },
  { key: "PAID", label: "Paid" },
] as const;

export type DroneFunnelStep = (typeof DRONE_FUNNEL_STEPS)[number]["key"];
export const DRONE_FUNNEL_KEYS: readonly string[] = DRONE_FUNNEL_STEPS.map((s) => s.key);
/** The tab-only fallback id (see components/FunnelBeacon.tsx). */
export const FUNNEL_SESSION_KEY = "procam_funnel_sid";
/** The lasting id of this browser on this device: the funnel and the location traffic count a device once. */
export const DEVICE_ID_KEY = "procam_device_id";
export const FUNNEL_PAYING_KEY = "procam_funnel_paying";

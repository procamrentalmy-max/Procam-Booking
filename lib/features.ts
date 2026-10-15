/**
 * Switches for whole parts of the product. ProCam started with hotel-locker camera rentals and added drone rental; for now only the drone
 * rental is live. Setting HOTEL_LOCKERS_ENABLED back to true brings the locker side (its public booking pages, the staff area, the admin
 * pages and the print agent) back exactly as it was: nothing was deleted, the proxy just stops letting requests through.
 */
export const HOTEL_LOCKERS_ENABLED = false;

/** Public and staff-facing paths of the locker side. A path matches when it is exactly one of these or sits under it. */
const LOCKER_PAGE_PREFIXES = ["/p", "/pp", "/r", "/terms", "/staff"];
const LOCKER_API_PREFIXES = ["/api/print-agent"];
/** Admin pages that only belong to the locker side. The drone pages live under /admin/drone-rental. */
export const LOCKER_ADMIN_PREFIXES = [
  "/admin/bookings",
  "/admin/damage-cases",
  "/admin/rental-assets",
  "/admin/batteries",
  "/admin/travel-times",
  "/admin/capacity",
  "/admin/sales",
  "/admin/funnel",
  "/admin/partners",
  "/admin/products",
  "/admin/rental-packages",
];

const under = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** What to do with a request while the locker side is switched off: nothing, show the "paused" page, send an admin back to the dashboard, or refuse an API call. */
export function lockerGate(pathname: string): "pass" | "paused" | "admin-home" | "gone" {
  if (HOTEL_LOCKERS_ENABLED) return "pass";
  if (LOCKER_PAGE_PREFIXES.some((p) => under(pathname, p))) return "paused";
  if (LOCKER_API_PREFIXES.some((p) => under(pathname, p))) return "gone";
  if (LOCKER_ADMIN_PREFIXES.some((p) => under(pathname, p))) return "admin-home";
  return "pass";
}

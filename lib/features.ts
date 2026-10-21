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

/**
 * The online ID check (a photo of the MyKad or passport and a live selfie, done on the customer's phone through Didit) before a drone is held.
 * Switched off: the booking and walk-in forms go straight on, nothing is sent to Didit, there is no ID check cost in the earnings, and the legal pages
 * and FAQ say the staff check the photo ID at collection. Setting this back to true brings the check back exactly as it was (the code, the Didit
 * keys and the ID-check texts are all still there).
 */
export const DRONE_ID_CHECK_ENABLED = false;

/**
 * Renting by the day (1 to 3 days, 3 batteries and a charger included). Switched off: customers can only choose hours, on the home page, the booking page and
 * the shop QR order page; a daily booking is refused if one is sent anyway; the FAQ and the price line in the Terms say nothing about it. Bookings already
 * made by the day still work to the end (pickup, return, prices), and the daily prices, pictures and texts are all still there. Setting this back to true
 * brings it back exactly as it was.
 */
export const DAILY_RENTAL_ENABLED = false;

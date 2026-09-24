import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { buildShopFleetSnapshot } from "./snapshot";
import { firstAvailableAt } from "./slots";

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in km — good enough for "which pickup spot is closest," not turn-by-turn routing. */
export function haversineDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type ShopWithAvailability = {
  id: string;
  humanId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  googleMapsUrl: string | null;
  distanceKm: number | null;
  firstAvailableAt: string | null; // ISO, or null if nothing is ever eligible right now (e.g. every drone is down)
};

/**
 * Every active shop plus, for each, when its soonest drone is actually
 * bookable — this is what powers the "first available now" / "available at
 * HH:MM" label on the pickup map's markers. Distance is computed from the
 * customer's browser-reported location when given; sorted nearest-first,
 * shops with an unknown location pushed to the end rather than dropped.
 */
export async function listActiveShopsWithAvailability(customerLocation: { lat: number; lng: number } | null): Promise<ShopWithAvailability[]> {
  const supabase = createServiceRoleClient();
  const { data: shops } = await supabase
    .from("dr_shops")
    .select("id,human_id,name,address,lat,lng,google_maps_url")
    .eq("active", true)
    .order("name");

  const now = new Date();
  const withAvailability = await Promise.all(
    (shops ?? []).map(async (shop) => {
      const snapshot = await buildShopFleetSnapshot(shop.id);
      const soonest = firstAvailableAt(snapshot.drones, snapshot.bookings, now);
      return {
        id: shop.id,
        humanId: shop.human_id,
        name: shop.name,
        address: shop.address,
        lat: shop.lat,
        lng: shop.lng,
        googleMapsUrl: shop.google_maps_url,
        distanceKm: customerLocation ? haversineDistanceKm(customerLocation, { lat: shop.lat, lng: shop.lng }) : null,
        firstAvailableAt: soonest ? soonest.toISOString() : null,
      };
    })
  );

  return withAvailability.sort((a, b) => {
    if (a.distanceKm === null && b.distanceKm === null) return 0;
    if (a.distanceKm === null) return 1;
    if (b.distanceKm === null) return -1;
    return a.distanceKm - b.distanceKm;
  });
}

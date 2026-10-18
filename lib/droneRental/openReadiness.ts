import { shopInfoComplete } from "./shopInfo";
import type { ShopHours } from "./hours";

/** What a location has now, from what is being saved and from the fleet at that shop. */
export type ShopReadiness = {
  address: string;
  lat: number;
  lng: number;
  hours: ShopHours;
  /** Drones at the shop that are not retired or lost. */
  workingDrones: number;
  /** Batteries that belong to the shop. */
  batteries: number;
};

/**
 * What is still missing before a location can be opened to customers (Book here and Get direction): a real address and a map position,
 * at least one day it is open, a drone to rent out and a battery to go with it. An empty list means it can open.
 */
export function openGaps(shop: ShopReadiness): string[] {
  const gaps: string[] = [];
  if (shop.address.trim() === "" || !shopInfoComplete({ address: shop.address, lat: Number.isFinite(shop.lat) ? shop.lat : 0, lng: Number.isFinite(shop.lng) ? shop.lng : 0 })) {
    gaps.push("a real address and its position on the map");
  }
  if (shop.hours.every((day) => day === null)) gaps.push("opening hours (it is marked closed every day)");
  if (shop.workingDrones < 1) gaps.push("a drone at this shop (add or move one here on the Fleet page)");
  if (shop.batteries < 1) gaps.push("a battery at this shop (add or move one here on the Fleet page)");
  return gaps;
}

/** The sentence shown when opening is refused. */
export function openGapsMessage(gaps: string[]): string {
  return `This location can't be opened to customers yet. Still needed: ${gaps.join("; ")}.`;
}

"use server";

import { z } from "zod";
import { listActiveShopsWithAvailability, type ShopWithAvailability } from "@/lib/droneRental/shops";

const locationSchema = z.object({ lat: z.number(), lng: z.number() }).nullable();

/** Re-fetches the shop list once the browser reports (or fails to report) the customer's location — sorts nearest-first when it has one. */
export async function getShopsWithAvailabilityAction(location: { lat: number; lng: number } | null): Promise<ShopWithAvailability[]> {
  const parsed = locationSchema.parse(location);
  return listActiveShopsWithAvailability(parsed);
}

"use server";

import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { buildShopFleetSnapshot } from "@/lib/droneRental/snapshot";
import { computeUnavailableStarts } from "@/lib/droneRental/slots";
import { findOrCreateCustomer, createPendingDroneBooking, NoDroneAvailableError } from "@/lib/droneRental/createBooking";

const unavailableStartsSchema = z.object({
  shopId: uuidSchema,
  durationMinutes: z.number().int().positive(),
  starts: z.array(z.string().min(1)).max(64),
});

/** Which of the candidate 30-minute start times have no drone free for the selected duration — greys out slots in the table before the customer even taps one. */
export async function getUnavailableDroneStartsAction(input: {
  shopId: string;
  durationMinutes: number;
  starts: string[];
}): Promise<{ unavailable: boolean[] }> {
  const parsed = unavailableStartsSchema.parse(input);
  const snapshot = await buildShopFleetSnapshot(parsed.shopId);
  const dates = parsed.starts.map((s) => new Date(s));
  const unavailable = computeUnavailableStarts(snapshot.drones, snapshot.bookings, parsed.durationMinutes, dates);
  return { unavailable };
}

const createBookingSchema = z.object({
  shopId: uuidSchema,
  durationMinutes: z.number().int().positive(),
  startTime: z.string().min(1),
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(6, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email"),
});

export async function createDroneBookingAction(input: {
  shopId: string;
  durationMinutes: number;
  startTime: string;
  name: string;
  phone: string;
  email: string;
}): Promise<{ secureToken: string; startTime: string; endTime: string }> {
  const parsed = createBookingSchema.parse(input);
  const start = new Date(parsed.startTime);
  if (Number.isNaN(start.getTime())) throw new Error("Invalid date/time.");

  const customerId = await findOrCreateCustomer({ name: parsed.name, phone: parsed.phone, email: parsed.email });

  try {
    const booking = await createPendingDroneBooking({
      customerId,
      shopId: parsed.shopId,
      durationMinutes: parsed.durationMinutes,
      earliestStartTime: start,
    });
    return { secureToken: booking.secure_token, startTime: booking.start_time, endTime: booking.end_time };
  } catch (err) {
    if (err instanceof NoDroneAvailableError) throw new Error("No drone is available for that time — try another slot or shop.");
    throw err;
  }
}

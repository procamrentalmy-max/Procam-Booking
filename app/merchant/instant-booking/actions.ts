"use server";

import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { getAuthContext, hasMerchantAccess } from "@/lib/auth/session";
import { buildShopFleetSnapshot } from "@/lib/droneRental/snapshot";
import { computeMerchantInstantOptions, type MerchantInstantOptions } from "@/lib/droneRental/merchantBooking";
import { findOrCreateCustomer, createMerchantInstantBooking, NoDroneAvailableError } from "@/lib/droneRental/createBooking";

const optionsSchema = z.object({ shopId: uuidSchema, droneId: uuidSchema });

export async function getMerchantInstantOptionsAction(input: { shopId: string; droneId: string }): Promise<MerchantInstantOptions> {
  const ctx = await getAuthContext();
  if (!hasMerchantAccess(ctx)) throw new Error("Not authorized");

  const parsed = optionsSchema.parse(input);
  const snapshot = await buildShopFleetSnapshot(parsed.shopId);
  return computeMerchantInstantOptions(snapshot.bookings, parsed.droneId, new Date());
}

const createSchema = z.object({
  shopId: uuidSchema,
  droneId: uuidSchema,
  durationMinutes: z.number().int().positive(),
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(6, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email"),
});

export async function createInstantBookingAction(input: {
  shopId: string;
  droneId: string;
  durationMinutes: number;
  name: string;
  phone: string;
  email: string;
}): Promise<{ bookingId: string; secureToken: string }> {
  const ctx = await getAuthContext();
  if (!hasMerchantAccess(ctx)) throw new Error("Not authorized");

  const parsed = createSchema.parse(input);

  // Re-validate right before creating — the options the merchant saw might
  // be a few seconds stale (another booking could have landed in between);
  // the drone_bookings exclude constraint is still the final backstop.
  const snapshot = await buildShopFleetSnapshot(parsed.shopId);
  const options = computeMerchantInstantOptions(snapshot.bookings, parsed.droneId, new Date());
  if (!options.allowed || parsed.durationMinutes > options.maxDurationMinutes) {
    throw new Error("This drone can no longer be booked for that long right now — check the available durations again.");
  }

  const customerId = await findOrCreateCustomer({ name: parsed.name, phone: parsed.phone, email: parsed.email });

  try {
    const booking = await createMerchantInstantBooking({
      customerId,
      shopId: parsed.shopId,
      droneId: parsed.droneId,
      durationMinutes: parsed.durationMinutes,
      createdByStaffId: ctx.staffId,
    });
    return { bookingId: booking.id, secureToken: booking.secure_token };
  } catch (err) {
    if (err instanceof NoDroneAvailableError) throw new Error("That drone was just booked by someone else — pick another.");
    throw err;
  }
}

"use server";

import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { getAuthContext, hasMerchantAccess } from "@/lib/auth/session";
import { canAccessShop } from "@/lib/droneRental/access";
import { buildShopFleetSnapshot } from "@/lib/droneRental/snapshot";
import { computeMerchantInstantOptions, type MerchantInstantOptions } from "@/lib/droneRental/merchantBooking";
import { createWalkInRequest, WalkInError } from "@/lib/droneRental/walkInRequests";

const optionsSchema = z.object({ shopId: uuidSchema, droneId: uuidSchema });

export async function getMerchantInstantOptionsAction(input: { shopId: string; droneId: string }): Promise<MerchantInstantOptions> {
  const ctx = await getAuthContext();
  if (!hasMerchantAccess(ctx)) throw new Error("Not authorized");

  const parsed = optionsSchema.parse(input);
  if (!(await canAccessShop(ctx, parsed.shopId))) throw new Error("Not authorized");
  const snapshot = await buildShopFleetSnapshot(parsed.shopId);
  return computeMerchantInstantOptions(snapshot.bookings, parsed.droneId, new Date());
}

const startSchema = z.object({
  shopId: uuidSchema,
  droneId: uuidSchema,
  durationMinutes: z.number().int().positive(),
});

/**
 * Starts a walk-in: no customer details yet — the customer fills those in
 * themselves from the QR code on the next screen, and the merchant
 * approves them there (see app/merchant/walk-in/[requestId]).
 */
export async function startWalkInAction(input: { shopId: string; droneId: string; durationMinutes: number }): Promise<{ requestId: string }> {
  const ctx = await getAuthContext();
  if (!hasMerchantAccess(ctx)) throw new Error("Not authorized");

  const parsed = startSchema.parse(input);
  if (!(await canAccessShop(ctx, parsed.shopId))) throw new Error("Not authorized");

  try {
    const { id } = await createWalkInRequest({ ...parsed, createdByStaffId: ctx.staffId });
    return { requestId: id };
  } catch (err) {
    if (err instanceof WalkInError) throw new Error(err.message);
    throw err;
  }
}

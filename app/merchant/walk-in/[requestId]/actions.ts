"use server";

import { revalidatePath } from "next/cache";
import { uuidSchema } from "@/lib/zod-helpers";
import { getAuthContext, hasMerchantAccess } from "@/lib/auth/session";
import { canAccessShop } from "@/lib/droneRental/access";
import { markDroneBookingPaidCash } from "@/lib/droneRental/payment";
import { acceptWalkInRequest, closeWalkInRequest, getWalkInRequestById, WalkInError } from "@/lib/droneRental/walkInRequests";

async function authorize(requestId: string) {
  const ctx = await getAuthContext();
  if (!hasMerchantAccess(ctx)) throw new Error("Not authorized");
  const id = uuidSchema.parse(requestId);
  const request = await getWalkInRequestById(id);
  if (!request || !(await canAccessShop(ctx, request.shop_id))) throw new Error("Not authorized");
  return { ctx, request };
}

/** Confirms the customer's order: assigns any free drone and creates the booking; the customer's phone then moves on to payment by itself. */
export async function confirmWalkInOrderAction(requestId: string): Promise<void> {
  const { ctx, request } = await authorize(requestId);
  try {
    await acceptWalkInRequest(request.id, ctx.staffId);
  } catch (err) {
    if (err instanceof WalkInError) throw new Error(err.message);
    throw err;
  }
  revalidatePath(`/merchant/walk-in/${request.id}`);
  revalidatePath("/merchant");
}

export async function declineWalkInOrderAction(requestId: string): Promise<void> {
  const { request } = await authorize(requestId);
  await closeWalkInRequest(request.id, "DECLINED");
  revalidatePath(`/merchant/walk-in/${request.id}`);
  revalidatePath("/merchant");
}

/** The customer pays the rental fee in cash at the counter instead of by card: the order is confirmed and handover can start. */
export async function markWalkInPaidCashAction(requestId: string): Promise<void> {
  const { request } = await authorize(requestId);
  if (!request.booking_id) throw new Error("Confirm the order first.");
  await markDroneBookingPaidCash(request.booking_id);
  revalidatePath(`/merchant/walk-in/${request.id}`);
  revalidatePath("/merchant");
}

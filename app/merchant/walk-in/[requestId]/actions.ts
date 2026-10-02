"use server";

import { revalidatePath } from "next/cache";
import { uuidSchema } from "@/lib/zod-helpers";
import { getAuthContext, hasMerchantAccess } from "@/lib/auth/session";
import { canAccessShop } from "@/lib/droneRental/access";
import { acceptWalkInRequest, closeWalkInRequest, getWalkInRequestById, WalkInError } from "@/lib/droneRental/walkInRequests";

async function authorize(requestId: string) {
  const ctx = await getAuthContext();
  if (!hasMerchantAccess(ctx)) throw new Error("Not authorized");
  const id = uuidSchema.parse(requestId);
  const request = await getWalkInRequestById(id);
  if (!request || !(await canAccessShop(ctx, request.shop_id))) throw new Error("Not authorized");
  return { ctx, request };
}

/** Approves the customer's details: creates the booking, and the customer's phone moves on to payment by itself. */
export async function acceptWalkInAction(requestId: string): Promise<void> {
  const { ctx, request } = await authorize(requestId);
  try {
    await acceptWalkInRequest(request.id, ctx.staffId);
  } catch (err) {
    if (err instanceof WalkInError) throw new Error(err.message);
    throw err;
  }
  revalidatePath(`/merchant/walk-in/${request.id}`);
}

export async function declineWalkInAction(requestId: string): Promise<void> {
  const { request } = await authorize(requestId);
  await closeWalkInRequest(request.id, "DECLINED");
  revalidatePath(`/merchant/walk-in/${request.id}`);
}

export async function cancelWalkInAction(requestId: string): Promise<void> {
  const { request } = await authorize(requestId);
  await closeWalkInRequest(request.id, "CANCELLED");
  revalidatePath(`/merchant/walk-in/${request.id}`);
}

"use server";

import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { confirmDroneKyc, devSkipDroneKyc, startDroneKyc, type DroneKycStart } from "@/lib/droneRental/kyc";

const detailsSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  phone: z.string().trim().regex(/^[0-9+\-()\s]{6,30}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email").max(200),
});

/** Public: someone about to rent a drone starts their ID check. */
export async function startDroneKycAction(input: { name: string; phone: string; email: string }): Promise<DroneKycStart> {
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Check your details.");
  return startDroneKyc(parsed.data);
}

/** Public: Didit says the check is done; the server confirms it with Didit before anything relies on it. */
export async function confirmDroneKycAction(verificationId: string): Promise<{ verified: boolean }> {
  const result = await confirmDroneKyc(uuidSchema.parse(verificationId));
  return { verified: result.verified };
}

/** Local development only. */
export async function devSkipDroneKycAction(verificationId: string): Promise<{ verified: true }> {
  await devSkipDroneKyc(uuidSchema.parse(verificationId));
  return { verified: true };
}

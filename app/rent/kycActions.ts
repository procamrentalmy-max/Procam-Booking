"use server";

import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { confirmDroneKyc, skipDroneKyc, startDroneKyc, type DroneKycStart } from "@/lib/droneRental/kyc";
import { getAuthContext, isAdmin } from "@/lib/auth/session";

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

/** Skips the ID check: local development, or a signed-in admin testing the live site. Nobody else can, whatever they send. */
export async function skipDroneKycAction(verificationId: string): Promise<{ verified: true }> {
  if (process.env.NODE_ENV === "production" && !isAdmin(await getAuthContext())) throw new Error("Not available.");
  await skipDroneKyc(uuidSchema.parse(verificationId));
  return { verified: true };
}

"use server";

import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { confirmDroneKyc, DroneKycError, skipDroneKyc, startDroneKyc, type DroneKycStart } from "@/lib/droneRental/kyc";
import { droneText, fieldError } from "@/lib/i18n/drone";
import { getLocale } from "@/lib/i18n/getLocale";
import { getAuthContext, isAdmin } from "@/lib/auth/session";

const detailsSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  phone: z.string().trim().regex(/^[0-9+\-()\s]{6,30}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email").max(200),
});

/** The refusal text in the visitor's language. Returned, not thrown: a thrown message never reaches the customer on the live site. */
async function kycErrorText(err: DroneKycError): Promise<string> {
  const t = droneText(await getLocale()).errors;
  return { cantStart: t.kycCantStart, notFound: t.kycNotFound, neverStarted: t.kycNeverStarted }[err.code];
}

/** Public: someone about to rent a drone starts their ID check. */
export async function startDroneKycAction(input: { name: string; phone: string; email: string }): Promise<DroneKycStart | { error: string }> {
  const parsed = detailsSchema.safeParse(input);
  if (!parsed.success) return { error: fieldError(droneText(await getLocale()).errors, parsed.error.issues[0]?.path[0]) };
  try {
    return await startDroneKyc(parsed.data);
  } catch (err) {
    if (err instanceof DroneKycError) return { error: await kycErrorText(err) };
    throw err;
  }
}

/** Public: Didit says the check is done; the server confirms it with Didit before anything relies on it. */
export async function confirmDroneKycAction(verificationId: string): Promise<{ verified: boolean } | { error: string }> {
  try {
    const result = await confirmDroneKyc(uuidSchema.parse(verificationId));
    return { verified: result.verified };
  } catch (err) {
    if (err instanceof DroneKycError) return { error: await kycErrorText(err) };
    throw err;
  }
}

/** Skips the ID check: local development, or a signed-in admin testing the live site. Nobody else can, whatever they send. */
export async function skipDroneKycAction(verificationId: string): Promise<{ verified: true }> {
  if (process.env.NODE_ENV === "production" && !isAdmin(await getAuthContext())) throw new Error("Not available.");
  await skipDroneKyc(uuidSchema.parse(verificationId));
  return { verified: true };
}

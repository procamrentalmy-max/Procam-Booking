import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createDiditSession, getDiditSessionStatus } from "@/lib/didit";
import { findOrCreateCustomer } from "./createBooking";

/** An ID check can be used for a booking for this long after it passed. */
const FRESH_HOURS = 2;

/** Why an ID check couldn't go on; the page words it in the visitor's language. */
export class DroneKycError extends Error {
  constructor(public readonly code: "cantStart" | "notFound" | "neverStarted") {
    super(code);
    this.name = "DroneKycError";
  }
}

export type DroneKycStart = { verified: true; verificationId: string } | { verified: false; verificationId: string; sessionUrl: string };

/**
 * Starts the ID check (ID document, live selfie and face match, run by Didit) for someone about to rent a drone. Every booking
 * needs its own check. KYC_BYPASS_ENABLED=true (local development only; it is not set in production) marks it passed at once.
 */
export async function startDroneKyc(params: { name: string; phone: string; email: string }): Promise<DroneKycStart> {
  const supabase = createServiceRoleClient();
  const customerId = await findOrCreateCustomer(params);
  const bypassed = process.env.KYC_BYPASS_ENABLED === "true";

  const { data: verification, error } = await supabase
    .from("identity_verifications")
    .insert(
      bypassed
        ? { customer_id: customerId, method: "DIDIT_KYC", status: "VERIFIED", verified_at: new Date().toISOString() }
        : { customer_id: customerId, method: "DIDIT_KYC", status: "PENDING" }
    )
    .select("id")
    .single();
  if (error || !verification) throw new DroneKycError("cantStart");
  if (bypassed) return { verified: true, verificationId: verification.id };

  const session = await createDiditSession(verification.id);
  await supabase.from("identity_verifications").update({ didit_session_id: session.sessionId }).eq("id", verification.id);
  return { verified: false, verificationId: verification.id, sessionUrl: session.url };
}

/** Re-checks the result with Didit itself (the browser's own report is not trusted) and records it. */
export async function confirmDroneKyc(verificationId: string): Promise<{ verified: boolean; status?: string }> {
  const supabase = createServiceRoleClient();
  const { data: verification } = await supabase.from("identity_verifications").select("id,status,didit_session_id").eq("id", verificationId).single();
  if (!verification) throw new DroneKycError("notFound");
  if (verification.status === "VERIFIED") return { verified: true };
  if (!verification.didit_session_id) throw new DroneKycError("neverStarted");

  const status = await getDiditSessionStatus(verification.didit_session_id);
  if (status !== "Approved") return { verified: false, status };
  await supabase.from("identity_verifications").update({ status: "VERIFIED", verified_at: new Date().toISOString() }).eq("id", verification.id);
  return { verified: true };
}

/** Marks the ID check passed without Didit. Callers must have checked it is allowed (local development, or a signed-in admin testing the live site). */
export async function skipDroneKyc(verificationId: string): Promise<void> {
  await createServiceRoleClient().from("identity_verifications").update({ status: "VERIFIED", verified_at: new Date().toISOString() }).eq("id", verificationId);
}

/**
 * Uses up a passed ID check for one booking: it must belong to this customer, have passed in the last couple of hours and not
 * have been used already. Returns false when it can't be used. Done in one step so two bookings can't both rely on it.
 */
export async function claimVerification(verificationId: string, customerId: string): Promise<boolean> {
  const since = new Date(Date.now() - FRESH_HOURS * 3600_000).toISOString();
  const { data } = await createServiceRoleClient()
    .from("identity_verifications")
    .update({ used_at: new Date().toISOString() })
    .eq("id", verificationId)
    .eq("customer_id", customerId)
    .eq("status", "VERIFIED")
    .is("used_at", null)
    .gte("verified_at", since)
    .select("id");
  return !!data && data.length > 0;
}

/** Gives the ID check back when the booking it was claimed for did not go through (the slot was taken, say), so they don't pay for another. */
export async function releaseVerification(verificationId: string): Promise<void> {
  await createServiceRoleClient().from("identity_verifications").update({ used_at: null }).eq("id", verificationId);
}

export const ID_CHECK_NEEDED = "Please verify your ID first.";

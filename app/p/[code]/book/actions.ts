"use server";

import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createDiditSession, getDiditSessionStatus } from "@/lib/didit";
import { createPendingLockerBooking, NoAssetAvailableError, InvalidBookingRequestError } from "@/lib/booking/createLockerBooking";
import { buildLockerFleetSnapshot } from "@/lib/booking/lockerSnapshot";
import { findEligibleAsset } from "@/lib/locker-engine/feasibility";
import { isPhoneCompatible } from "@/lib/booking/phone-compatibility";
import { recordBookingAcknowledgement } from "@/lib/booking/terms";
import { bookingDashboardUrl } from "@/lib/urls";
import { logFunnelEvent } from "@/lib/funnel";

const phoneCompatibilitySchema = z.object({
  productId: uuidSchema,
  manufacturer: z.string().min(1, "Select a manufacturer"),
  model: z.string().min(1, "Enter a model"),
  variant: z.string().optional(),
});

/** Server-side gate — the client never gets to declare its own phone "compatible". */
export async function checkPhoneCompatibilityAction(input: {
  productId: string;
  manufacturer: string;
  model: string;
  variant?: string;
}): Promise<{ compatible: boolean }> {
  const parsed = phoneCompatibilitySchema.parse(input);
  const compatible = await isPhoneCompatible(parsed.productId, parsed.manufacturer, parsed.model, parsed.variant ?? "");
  return { compatible };
}

const startSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(6, "Enter a valid phone number"),
  email: z.string().email("Enter a valid email"),
  partnerId: uuidSchema,
});

/**
 * Creates the customer + a verification row, then starts a Didit KYC session
 * for it — unless KYC_BYPASS_ENABLED is set, a temporary global switch to
 * accept bookings without ID verification (Didit account issues, or not
 * ready to require it of real customers yet). When bypassed, the row is
 * inserted straight to VERIFIED and sessionUrl is null; the wizard reads
 * that and skips its "verify" step entirely rather than showing a Didit
 * modal that would never be needed.
 */
export async function startKycAction(input: { name: string; phone: string; email: string; partnerId: string }) {
  const parsed = startSchema.parse(input);
  const supabase = createServiceRoleClient();
  const email = parsed.email.toLowerCase();

  await logFunnelEvent("VERIFICATION_STARTED", parsed.partnerId);

  const { data: existing } = await supabase.from("customers").select("id").eq("email", email).maybeSingle();

  let customerId = existing?.id as string | undefined;
  if (!customerId) {
    const { data: created, error } = await supabase
      .from("customers")
      .insert({ name: parsed.name, phone: parsed.phone, email })
      .select("id")
      .single();
    if (error || !created) throw new Error("Could not start your booking. Please try again.");
    customerId = created.id;
  }

  const bypassed = process.env.KYC_BYPASS_ENABLED === "true";

  const { data: verification, error: verificationError } = await supabase
    .from("identity_verifications")
    .insert(
      bypassed
        ? { customer_id: customerId, method: "DIDIT_KYC", status: "VERIFIED", verified_at: new Date().toISOString() }
        : { customer_id: customerId, method: "DIDIT_KYC", status: "PENDING" }
    )
    .select("id")
    .single();
  if (verificationError || !verification) throw new Error("Could not start verification. Please try again.");

  if (bypassed) {
    await logFunnelEvent("VERIFICATION_VERIFIED", parsed.partnerId);
    return { customerId: customerId as string, verificationId: verification.id as string, sessionUrl: null };
  }

  const session = await createDiditSession(verification.id);
  await supabase.from("identity_verifications").update({ didit_session_id: session.sessionId }).eq("id", verification.id);

  return { customerId: customerId as string, verificationId: verification.id as string, sessionUrl: session.url };
}

const confirmKycSchema = z.object({
  verificationId: uuidSchema,
  partnerId: uuidSchema,
});

/**
 * The Didit modal's own onComplete callback reports a status, but that's a
 * client-reported signal — this re-checks with Didit's own API before ever
 * marking a verification (and so a booking) as good to proceed.
 */
export async function confirmKycAction(input: { verificationId: string; partnerId: string }) {
  const parsed = confirmKycSchema.parse(input);
  const supabase = createServiceRoleClient();

  const { data: verification } = await supabase
    .from("identity_verifications")
    .select("id,status,didit_session_id")
    .eq("id", parsed.verificationId)
    .single();

  if (!verification) throw new Error("Verification not found. Please start again.");
  if (verification.status === "VERIFIED") return { verified: true as const };
  if (!verification.didit_session_id) throw new Error("Verification session missing. Please start again.");

  const status = await getDiditSessionStatus(verification.didit_session_id);
  if (status !== "Approved") return { verified: false as const, status };

  await supabase
    .from("identity_verifications")
    .update({ status: "VERIFIED", verified_at: new Date().toISOString() })
    .eq("id", verification.id);

  await logFunnelEvent("VERIFICATION_VERIFIED", parsed.partnerId);

  return { verified: true as const };
}

/**
 * Marks a verification VERIFIED without touching Didit at all — real ID+selfie
 * capture can't be meaningfully faked, and requiring it on every test booking
 * would make testing the rest of the flow (overbooking, admin, staff) painful.
 * `next build`/`next start` (what every real deploy — prod or preview — runs)
 * always sets NODE_ENV to "production", only `next dev` doesn't, so this can
 * never run against a real deployment regardless of which env vars are set.
 */
export async function devSkipKycAction(input: { verificationId: string; partnerId: string }) {
  if (process.env.NODE_ENV === "production") throw new Error("Not available.");
  const parsed = confirmKycSchema.parse(input);
  const supabase = createServiceRoleClient();

  await supabase
    .from("identity_verifications")
    .update({ status: "VERIFIED", verified_at: new Date().toISOString() })
    .eq("id", parsed.verificationId);

  await logFunnelEvent("VERIFICATION_VERIFIED", parsed.partnerId);

  return { verified: true as const };
}

const hourAvailabilitySchema = z.object({
  productId: uuidSchema,
  starts: z.array(z.string().min(1)).max(24),
});

/**
 * Which of the given candidate start times (each checked as a bare 1-hour
 * window) currently have no eligible camera at all — used to dull those
 * slots in the timetable before the customer picks one. This is a cheap
 * proxy, not the real gate: a hour can look free here for a 1-hour rental
 * and still turn out infeasible once the customer's actual end hour makes
 * it a longer window, since the shared start/end grid doesn't know the
 * duration until both taps happen. createBookingAction's own call into
 * checkLockerBookingFeasibility remains the real authority.
 */
export async function getUnavailableStartsAction(input: { productId: string; starts: string[] }): Promise<{ unavailable: string[] }> {
  const parsed = hourAvailabilitySchema.parse(input);
  const snapshot = await buildLockerFleetSnapshot(parsed.productId);

  const unavailable = parsed.starts.filter((iso) => {
    const start = new Date(iso);
    if (Number.isNaN(start.getTime())) return true;
    const end = new Date(start.getTime() + 60 * 60_000);
    return !findEligibleAsset(snapshot, start, end);
  });

  return { unavailable };
}

const createBookingSchema = z.object({
  customerId: uuidSchema,
  verificationId: uuidSchema,
  partnerId: uuidSchema,
  dropoffPartnerId: uuidSchema,
  rentalPackageId: uuidSchema,
  referralCode: z.string().nullable(),
  startTime: z.string().min(1),
  termsVersionId: uuidSchema.nullable(),
});

export async function createBookingAction(input: {
  customerId: string;
  verificationId: string;
  partnerId: string;
  dropoffPartnerId: string;
  rentalPackageId: string;
  referralCode: string | null;
  startTime: string;
  termsVersionId: string | null;
}) {
  const parsed = createBookingSchema.parse(input);
  const supabase = createServiceRoleClient();

  const { data: verification } = await supabase
    .from("identity_verifications")
    .select("customer_id,status")
    .eq("id", parsed.verificationId)
    .single();

  if (!verification || verification.customer_id !== parsed.customerId || verification.status !== "VERIFIED") {
    throw new Error("Identity verification is required before booking.");
  }

  const startTime = new Date(parsed.startTime);
  if (Number.isNaN(startTime.getTime())) throw new Error("Please choose a valid date and time.");

  try {
    const booking = await createPendingLockerBooking({
      customerId: parsed.customerId,
      partnerId: parsed.partnerId,
      dropoffPartnerId: parsed.dropoffPartnerId,
      rentalPackageId: parsed.rentalPackageId,
      earliestStartTime: startTime,
      source: "PARTNER_QR",
      referralCode: parsed.referralCode,
    });

    if (parsed.termsVersionId) {
      // Best-effort: a missing acknowledgement row is a record-keeping gap,
      // not a reason to fail a booking that's already been created and paid for.
      await recordBookingAcknowledgement(booking.id, parsed.termsVersionId).catch((err) =>
        console.error("[booking] failed to record terms acknowledgement", err)
      );
    }

    await logFunnelEvent("BOOKING_CREATED", parsed.partnerId);

    return {
      secureToken: booking.secure_token as string,
      dashboardUrl: bookingDashboardUrl(booking.secure_token),
      // The engine may have assigned a later slot than requested — the
      // wizard shows this so the customer isn't surprised on the next page.
      startTime: booking.start_time as string,
      endTime: booking.end_time as string,
    };
  } catch (err) {
    if (err instanceof NoAssetAvailableError || err instanceof InvalidBookingRequestError) throw new Error(err.message);
    throw err;
  }
}

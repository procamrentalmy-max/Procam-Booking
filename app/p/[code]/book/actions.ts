"use server";

import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getNotificationProvider } from "@/lib/notifications";
import { generateOtpCode, hashOtpCode, otpCodeMatches, OTP_TTL_MINUTES, OTP_MAX_ATTEMPTS } from "@/lib/otp";
import { createPendingLockerBooking, NoAssetAvailableError, InvalidBookingRequestError } from "@/lib/booking/createLockerBooking";
import { buildLockerFleetSnapshot } from "@/lib/booking/lockerSnapshot";
import { findEligibleAsset } from "@/lib/locker-engine/feasibility";
import { isPhoneCompatible } from "@/lib/booking/phone-compatibility";
import { recordBookingAcknowledgement } from "@/lib/booking/terms";
import { bookingDashboardUrl } from "@/lib/urls";

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
});

export async function startVerificationAction(input: { name: string; phone: string; email: string }) {
  const parsed = startSchema.parse(input);
  const supabase = createServiceRoleClient();
  const email = parsed.email.toLowerCase();

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

  const code = generateOtpCode();
  const { data: verification, error: verificationError } = await supabase
    .from("identity_verifications")
    .insert({
      customer_id: customerId,
      method: "WHATSAPP_OTP",
      otp_code_hash: hashOtpCode(code),
      otp_expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString(),
      status: "PENDING",
    })
    .select("id")
    .single();
  if (verificationError || !verification) throw new Error("Could not start verification. Please try again.");

  await getNotificationProvider().sendWhatsApp({
    to: parsed.phone,
    templateName: process.env.WHATSAPP_OTP_TEMPLATE_NAME ?? "otp_code",
    templateParams: [code],
  });

  return { customerId: customerId as string, verificationId: verification.id as string };
}

const verifySchema = z.object({
  verificationId: uuidSchema,
  code: z.string().length(6, "Enter the 6-digit code"),
});

export async function verifyOtpAction(input: { verificationId: string; code: string }) {
  const parsed = verifySchema.parse(input);
  const supabase = createServiceRoleClient();

  const { data: verification } = await supabase
    .from("identity_verifications")
    .select("*")
    .eq("id", parsed.verificationId)
    .single();

  if (!verification) throw new Error("Verification not found. Please start again.");
  if (verification.status === "VERIFIED") return { verified: true as const };
  if (verification.otp_attempts >= OTP_MAX_ATTEMPTS) throw new Error("Too many attempts. Please start again.");
  if (!verification.otp_expires_at || new Date(verification.otp_expires_at) < new Date()) {
    throw new Error("This code has expired. Please start again.");
  }
  if (!verification.otp_code_hash || !otpCodeMatches(parsed.code, verification.otp_code_hash)) {
    await supabase
      .from("identity_verifications")
      .update({ otp_attempts: verification.otp_attempts + 1 })
      .eq("id", verification.id);
    throw new Error("Incorrect code.");
  }

  await supabase
    .from("identity_verifications")
    .update({ status: "VERIFIED", otp_verified_at: new Date().toISOString() })
    .eq("id", verification.id);

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

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthContext, hasStaffAccess } from "@/lib/auth/session";
import { getStripe } from "@/lib/stripe/client";
import { assertValidBookingTransition } from "@/lib/state-machine/booking";
import { logAudit } from "@/lib/audit";
import type { BookingStatus, DamageCategory } from "@/lib/db/types";

const baseSchema = z.object({
  assetId: uuidSchema,
  bookingId: uuidSchema,
  checklist: z.string(), // JSON-encoded Record<string, boolean>
  notes: z.string().optional(),
});

/**
 * PASS: releases the deposit hold, accrues the partner's commission on the
 * rental fee only (never on the deposit — spec section 2/22), and moves the
 * asset back into the fleet via CLEANING -> CHARGING -> AVAILABLE. Staff
 * can never do the DAMAGE side of this without an admin later — but PASS
 * itself is a normal staff decision, no admin step required.
 */
export async function passInspectionAction(formData: FormData) {
  const ctx = await getAuthContext();
  if (!hasStaffAccess(ctx)) throw new Error("Not authorized.");

  const parsed = baseSchema.parse({
    assetId: formData.get("assetId"),
    bookingId: formData.get("bookingId"),
    checklist: formData.get("checklist"),
    notes: formData.get("notes"),
  });

  const supabase = await createServerSupabaseClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("status,partner_id")
    .eq("id", parsed.bookingId)
    .single();
  if (!booking) throw new Error("Booking not found.");
  assertValidBookingTransition(booking.status as BookingStatus, "COMPLETED");

  const { error: inspectionError } = await supabase.from("inspections").insert({
    booking_id: parsed.bookingId,
    asset_id: parsed.assetId,
    inspector_staff_id: ctx.staffId,
    result: "PASS",
    checklist: JSON.parse(parsed.checklist),
    notes: parsed.notes || null,
  });
  if (inspectionError) throw new Error(inspectionError.message);

  await supabase.rpc("transition_asset_status", {
    p_asset_id: parsed.assetId,
    p_to_status: "INSPECTION",
    p_booking_id: parsed.bookingId,
    p_event_type: "STAFF_INSPECTION",
  });
  const { error: cleaningError } = await supabase.rpc("transition_asset_status", {
    p_asset_id: parsed.assetId,
    p_to_status: "CLEANING",
    p_booking_id: parsed.bookingId,
    p_event_type: "PASS",
  });
  if (cleaningError) throw new Error(cleaningError.message);

  const { error: bookingError } = await supabase
    .from("bookings")
    .update({ status: "COMPLETED" })
    .eq("id", parsed.bookingId);
  if (bookingError) throw new Error(bookingError.message);

  await logAudit({
    actorType: ctx.kind === "admin" ? "ADMIN" : "STAFF",
    actorId: ctx.staffId,
    action: "INSPECTION_PASSED",
    entityType: "booking",
    entityId: parsed.bookingId,
    after: { result: "PASS" },
  });

  // Release the deposit hold.
  const { data: deposit } = await supabase
    .from("deposit_authorizations")
    .select("id,provider_ref,status")
    .eq("booking_id", parsed.bookingId)
    .maybeSingle();
  if (deposit && deposit.status === "AUTHORIZED") {
    await getStripe().paymentIntents.cancel(deposit.provider_ref);
    await supabase
      .from("deposit_authorizations")
      .update({ status: "RELEASED", resolved_at: new Date().toISOString(), resolved_by: ctx.staffId })
      .eq("id", deposit.id);
  }

  // Accrue the partner's commission — rental fee only, never the deposit.
  const [{ data: payment }, { data: partner }] = await Promise.all([
    supabase
      .from("payments")
      .select("amount_myr")
      .eq("booking_id", parsed.bookingId)
      .eq("kind", "RENTAL_FEE")
      .eq("status", "SUCCEEDED")
      .maybeSingle(),
    supabase.from("partners").select("commission_rate").eq("id", booking.partner_id).single(),
  ]);
  if (payment && partner) {
    const commissionAmount = Math.round(payment.amount_myr * partner.commission_rate * 100) / 100;
    await supabase.from("commissions").insert({
      booking_id: parsed.bookingId,
      partner_id: booking.partner_id,
      rental_amount_myr: payment.amount_myr,
      rate: partner.commission_rate,
      commission_amount_myr: commissionAmount,
      status: "ACCRUED",
    });
  }

  revalidatePath("/staff/inspections");
}

const damageSchema = baseSchema.extend({
  category: z.enum([
    "LENS_SCRATCH",
    "SEVERE_LENS_DAMAGE",
    "SCREEN_DAMAGE",
    "BODY_DAMAGE",
    "WATER_DAMAGE",
    "MISSING_ACCESSORY",
    "MISSING_BATTERY",
    "CAMERA_MISSING",
    "FUNCTIONALITY_ISSUE",
    "OTHER",
    "HOUSING_CRACK",
    "OPTICAL_WINDOW_DAMAGE",
    "SEAL_ORING_FAILURE",
    "LOCKING_LATCH_DAMAGE",
    "VACUUM_SYSTEM_FAULT",
    "MOISTURE_LEAK_DETECTED",
    "CORROSION_SALT_DAMAGE",
    "HOUSING_MISSING",
  ]),
  description: z.string().min(1, "Describe the issue"),
});

/**
 * DAMAGE: asset goes to MAINTENANCE (never back to the fleet without a
 * staff member separately clearing it) and the booking to DAMAGE_REVIEW.
 * The deposit is untouched here — only an admin can capture or release it,
 * from the admin damage-case screen (not built in this pass).
 */
export async function reportDamageAction(formData: FormData) {
  const ctx = await getAuthContext();
  if (!hasStaffAccess(ctx)) throw new Error("Not authorized.");

  const parsed = damageSchema.parse({
    assetId: formData.get("assetId"),
    bookingId: formData.get("bookingId"),
    checklist: formData.get("checklist"),
    notes: formData.get("notes"),
    category: formData.get("category"),
    description: formData.get("description"),
  });

  const supabase = await createServerSupabaseClient();

  const { data: booking } = await supabase.from("bookings").select("status").eq("id", parsed.bookingId).single();
  if (!booking) throw new Error("Booking not found.");
  assertValidBookingTransition(booking.status as BookingStatus, "DAMAGE_REVIEW");

  const { data: inspection, error: inspectionError } = await supabase
    .from("inspections")
    .insert({
      booking_id: parsed.bookingId,
      asset_id: parsed.assetId,
      inspector_staff_id: ctx.staffId,
      result: "DAMAGE",
      checklist: JSON.parse(parsed.checklist),
      notes: parsed.notes || null,
    })
    .select("id")
    .single();
  if (inspectionError || !inspection) throw new Error(inspectionError?.message ?? "Could not save inspection.");

  const { error: damageError } = await supabase.from("damage_cases").insert({
    inspection_id: inspection.id,
    booking_id: parsed.bookingId,
    category: parsed.category as DamageCategory,
    description: parsed.description,
    status: "OPEN",
  });
  if (damageError) throw new Error(damageError.message);

  await supabase.rpc("transition_asset_status", {
    p_asset_id: parsed.assetId,
    p_to_status: "INSPECTION",
    p_booking_id: parsed.bookingId,
    p_event_type: "STAFF_INSPECTION",
  });
  const { error: assetError } = await supabase.rpc("transition_asset_status", {
    p_asset_id: parsed.assetId,
    p_to_status: "MAINTENANCE",
    p_booking_id: parsed.bookingId,
    p_event_type: "DAMAGE",
  });
  if (assetError) throw new Error(assetError.message);

  const { error: bookingError } = await supabase
    .from("bookings")
    .update({ status: "DAMAGE_REVIEW" })
    .eq("id", parsed.bookingId);
  if (bookingError) throw new Error(bookingError.message);

  await logAudit({
    actorType: ctx.kind === "admin" ? "ADMIN" : "STAFF",
    actorId: ctx.staffId,
    action: "INSPECTION_DAMAGE_REPORTED",
    entityType: "booking",
    entityId: parsed.bookingId,
    after: { result: "DAMAGE", category: parsed.category },
  });

  revalidatePath("/staff/inspections");
}

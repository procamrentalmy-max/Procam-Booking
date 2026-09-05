"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthContext, isAdmin } from "@/lib/auth/session";
import { getStripe, toCents } from "@/lib/stripe/client";
import { assertValidBookingTransition } from "@/lib/state-machine/booking";
import { logAudit } from "@/lib/audit";
import type { BookingStatus, DepositAction } from "@/lib/db/types";

const schema = z.object({
  damageCaseId: uuidSchema,
  bookingId: uuidSchema,
  depositAction: z.enum(["NONE", "PARTIALLY_CAPTURED", "CAPTURED"]),
  damageAmountMyr: z.coerce.number().min(0),
  resolutionNotes: z.string().min(1, "Resolution notes are required"),
});

/**
 * The financial close-out for a DAMAGE_REVIEW booking — the one remaining
 * place its deposit hold ever gets resolved, since reportDamageAction
 * (app/staff/inspections/[assetId]/actions.ts) deliberately never touches
 * the deposit itself. Any late fee this booking owes (see
 * lib/booking/lateFee.ts) never got captured either, for the same reason
 * — PASS is what captures a late fee, and this booking never reached
 * PASS — so it's combined into the same single capture here: a
 * manual-capture PaymentIntent only supports being captured once.
 *
 * Asset recovery (MAINTENANCE -> back into the fleet once repaired) is a
 * separate, already-existing admin action (app/admin/rental-assets) and
 * deliberately untouched here — this action is scoped to the money and the
 * booking's own status only.
 */
export async function resolveDamageCaseAction(formData: FormData) {
  const ctx = await getAuthContext();
  if (!isAdmin(ctx)) throw new Error("Not authorized.");

  const parsed = schema.parse({
    damageCaseId: formData.get("damageCaseId"),
    bookingId: formData.get("bookingId"),
    depositAction: formData.get("depositAction"),
    damageAmountMyr: formData.get("damageAmountMyr"),
    resolutionNotes: formData.get("resolutionNotes"),
  });

  const supabase = await createServerSupabaseClient();

  const { data: damageCase } = await supabase
    .from("damage_cases")
    .select("id,status")
    .eq("id", parsed.damageCaseId)
    .single();
  if (!damageCase) throw new Error("Damage case not found.");
  if (damageCase.status === "RESOLVED") throw new Error("This damage case is already resolved.");

  const { data: booking } = await supabase
    .from("bookings")
    .select("status,late_fee_myr")
    .eq("id", parsed.bookingId)
    .single();
  if (!booking) throw new Error("Booking not found.");
  assertValidBookingTransition(booking.status as BookingStatus, "COMPLETED");

  const { data: deposit } = await supabase
    .from("deposit_authorizations")
    .select("id,provider_ref,status,amount_myr")
    .eq("booking_id", parsed.bookingId)
    .maybeSingle();
  if (!deposit) throw new Error("No deposit hold found for this booking.");
  if (deposit.status !== "AUTHORIZED") throw new Error("This deposit has already been resolved.");

  const damageAmountMyr = parsed.depositAction === "PARTIALLY_CAPTURED" ? parsed.damageAmountMyr : 0;
  const requestedTotal =
    parsed.depositAction === "CAPTURED" ? deposit.amount_myr : damageAmountMyr + Number(booking.late_fee_myr);
  const captureMyr = Math.min(requestedTotal, deposit.amount_myr);

  const stripe = getStripe();
  if (captureMyr > 0) {
    await stripe.paymentIntents.capture(deposit.provider_ref, { amount_to_capture: toCents(captureMyr) });
  } else {
    await stripe.paymentIntents.cancel(deposit.provider_ref);
  }

  const lateFeePortion = Math.min(Number(booking.late_fee_myr), captureMyr);
  const damagePortion = captureMyr - lateFeePortion;

  // payments has a unique (provider, provider_ref) index — fine for a
  // single capture recorded as a single row, but this one Stripe capture
  // can produce two ledger lines (late fee + damage), so each needs its
  // own distinguishing ref rather than both reusing the bare PaymentIntent id.
  if (lateFeePortion > 0) {
    await supabase.from("payments").insert({
      booking_id: parsed.bookingId,
      kind: "LATE_FEE",
      provider: "stripe",
      provider_ref: `${deposit.provider_ref}#late_fee`,
      amount_myr: lateFeePortion,
      status: "SUCCEEDED",
    });
  }
  if (damagePortion > 0) {
    await supabase.from("payments").insert({
      booking_id: parsed.bookingId,
      kind: "DAMAGE_FEE",
      provider: "stripe",
      provider_ref: `${deposit.provider_ref}#damage_fee`,
      amount_myr: damagePortion,
      status: "SUCCEEDED",
    });
  }

  const newDepositStatus = captureMyr <= 0 ? "RELEASED" : captureMyr >= deposit.amount_myr ? "CAPTURED" : "PARTIALLY_CAPTURED";
  const { error: depositError } = await supabase
    .from("deposit_authorizations")
    .update({ status: newDepositStatus, resolved_at: new Date().toISOString(), resolved_by: ctx.staffId })
    .eq("id", deposit.id);
  if (depositError) throw new Error(depositError.message);

  const { error: damageCaseError } = await supabase
    .from("damage_cases")
    .update({
      status: "RESOLVED",
      resolution_notes: parsed.resolutionNotes,
      deposit_action: parsed.depositAction as DepositAction,
      resolved_by: ctx.staffId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", parsed.damageCaseId);
  if (damageCaseError) throw new Error(damageCaseError.message);

  const { error: bookingError } = await supabase
    .from("bookings")
    .update({ status: "COMPLETED" })
    .eq("id", parsed.bookingId);
  if (bookingError) throw new Error(bookingError.message);

  await logAudit({
    actorType: "ADMIN",
    actorId: ctx.staffId,
    action: "DAMAGE_CASE_RESOLVED",
    entityType: "damage_case",
    entityId: parsed.damageCaseId,
    before: { status: damageCase.status },
    after: { status: "RESOLVED", depositAction: parsed.depositAction, capturedMyr: captureMyr },
  });

  revalidatePath("/admin/damage-cases");
}

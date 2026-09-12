"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ALL_ASSET_STATUSES } from "@/lib/state-machine/asset";

const uuidOrEmpty = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || uuidSchema.safeParse(v).success, "Invalid partner");

const createAssetSchema = z.object({
  productId: uuidSchema,
  model: z.string().min(1),
  serialNumber: z.string().min(1),
  partnerId: uuidOrEmpty,
});

export async function createAssetAction(formData: FormData) {
  const parsed = createAssetSchema.safeParse({
    productId: formData.get("productId"),
    model: formData.get("model"),
    serialNumber: formData.get("serialNumber"),
    partnerId: formData.get("partnerId"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  // New units enter the fleet in MAINTENANCE — they need a staff prep/check
  // before ever becoming AVAILABLE, same as any other asset would.
  const { error } = await supabase.from("rental_assets").insert({
    product_id: parsed.data.productId,
    model: parsed.data.model,
    serial_number: parsed.data.serialNumber,
    partner_id: parsed.data.partnerId,
    status: "MAINTENANCE",
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/rental-assets");
}

const updateAssetSchema = z.object({
  id: uuidSchema,
  partnerId: uuidOrEmpty,
  notes: z.string().optional(),
});

/** Reassigning an asset between properties, or editing notes — not a status change. */
export async function updateAssetAction(formData: FormData) {
  const parsed = updateAssetSchema.safeParse({
    id: formData.get("id"),
    partnerId: formData.get("partnerId"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("rental_assets")
    .update({ partner_id: parsed.data.partnerId, notes: parsed.data.notes || null })
    .eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/rental-assets");
}

const transitionSchema = z.object({
  id: uuidSchema,
  toStatus: z.enum(ALL_ASSET_STATUSES as [string, ...string[]]),
});

/** Status changes go through the transition_asset_status RPC, which
 *  validates the move and writes the asset_events row atomically. */
export async function transitionAssetAction(formData: FormData) {
  const parsed = transitionSchema.safeParse({
    id: formData.get("id"),
    toStatus: formData.get("toStatus"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("transition_asset_status", {
    p_asset_id: parsed.data.id,
    p_to_status: parsed.data.toStatus as (typeof ALL_ASSET_STATUSES)[number],
    p_event_type: "ADMIN_MANUAL_CHANGE",
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/rental-assets");
}

const deleteAssetSchema = z.object({ id: uuidSchema });

/**
 * "Deleting" an asset means retiring it, not a real row delete — too much
 * real history (condition checks, inspections, maintenance, asset_events)
 * references rental_assets for a hard delete to ever be safe. RETIRED is
 * already excluded from every booking-eligibility check (see
 * INELIGIBLE_STATUSES in lib/locker-engine/feasibility.ts), so this asset
 * stops being offered anywhere the moment this runs, and it's a terminal
 * status — nothing can transition out of RETIRED afterward.
 */
export async function deleteAssetAction(formData: FormData) {
  const parsed = deleteAssetSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("transition_asset_status", {
    p_asset_id: parsed.data.id,
    p_to_status: "RETIRED",
    p_event_type: "ADMIN_MANUAL_CHANGE",
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/rental-assets");
}

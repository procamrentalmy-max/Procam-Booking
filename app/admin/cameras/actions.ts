"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ALL_CAMERA_STATUSES } from "@/lib/state-machine/camera";

const uuidOrEmpty = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.string().uuid().safeParse(v).success, "Invalid partner");

const createCameraSchema = z.object({
  model: z.string().min(1),
  serialNumber: z.string().min(1),
  partnerId: uuidOrEmpty,
});

export async function createCameraAction(formData: FormData) {
  const parsed = createCameraSchema.safeParse({
    model: formData.get("model"),
    serialNumber: formData.get("serialNumber"),
    partnerId: formData.get("partnerId"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  // New units enter the fleet in MAINTENANCE — they need a staff prep/check
  // before ever becoming AVAILABLE, same as any other camera would.
  const { error } = await supabase.from("cameras").insert({
    model: parsed.data.model,
    serial_number: parsed.data.serialNumber,
    partner_id: parsed.data.partnerId,
    status: "MAINTENANCE",
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/cameras");
}

const updateCameraSchema = z.object({
  id: z.string().uuid(),
  partnerId: uuidOrEmpty,
  notes: z.string().optional(),
});

/** Reassigning a camera between properties, or editing notes — not a status change. */
export async function updateCameraAction(formData: FormData) {
  const parsed = updateCameraSchema.safeParse({
    id: formData.get("id"),
    partnerId: formData.get("partnerId"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("cameras")
    .update({ partner_id: parsed.data.partnerId, notes: parsed.data.notes || null })
    .eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/cameras");
}

const transitionSchema = z.object({
  id: z.string().uuid(),
  toStatus: z.enum(ALL_CAMERA_STATUSES as [string, ...string[]]),
});

/** Status changes go through the transition_camera_status RPC, which
 *  validates the move and writes the asset_events row atomically. */
export async function transitionCameraAction(formData: FormData) {
  const parsed = transitionSchema.safeParse({
    id: formData.get("id"),
    toStatus: formData.get("toStatus"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("transition_camera_status", {
    p_camera_id: parsed.data.id,
    p_to_status: parsed.data.toStatus as (typeof ALL_CAMERA_STATUSES)[number],
    p_event_type: "ADMIN_MANUAL_CHANGE",
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/cameras");
}

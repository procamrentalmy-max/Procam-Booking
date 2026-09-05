"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const uuidOrEmpty = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || uuidSchema.safeParse(v).success, "Invalid partner");

function parseItems(raw: string | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const createKitSchema = z.object({
  productId: uuidSchema,
  partnerId: uuidOrEmpty,
  items: z.string().optional(),
});

export async function createKitAction(formData: FormData) {
  const parsed = createKitSchema.safeParse({
    productId: formData.get("productId"),
    partnerId: formData.get("partnerId"),
    items: formData.get("items"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { data: kit, error } = await supabase
    .from("kits")
    .insert({ product_id: parsed.data.productId, partner_id: parsed.data.partnerId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const items = parseItems(parsed.data.items ?? null);
  if (items.length > 0 && kit) {
    await supabase.from("kit_items").insert(items.map((item_name) => ({ kit_id: kit.id, item_name })));
  }

  revalidatePath("/admin/kits");
}

const updateKitSchema = z.object({
  id: uuidSchema,
  partnerId: uuidOrEmpty,
  status: z.enum(["AVAILABLE", "WITH_CUSTOMER", "AWAITING_INSPECTION", "MAINTENANCE", "RETIRED"]),
  items: z.string().optional(),
});

export async function updateKitAction(formData: FormData) {
  const parsed = updateKitSchema.safeParse({
    id: formData.get("id"),
    partnerId: formData.get("partnerId"),
    status: formData.get("status"),
    items: formData.get("items"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("kits")
    .update({ partner_id: parsed.data.partnerId, status: parsed.data.status })
    .eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  // Full replace rather than diffing — kit contents change rarely and the
  // list is short, so this is simpler than tracking per-item add/remove.
  await supabase.from("kit_items").delete().eq("kit_id", parsed.data.id);
  const items = parseItems(parsed.data.items ?? null);
  if (items.length > 0) {
    await supabase.from("kit_items").insert(items.map((item_name) => ({ kit_id: parsed.data.id, item_name })));
  }

  revalidatePath("/admin/kits");
}

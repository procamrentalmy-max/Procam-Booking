"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const addEntrySchema = z.object({
  productId: uuidSchema,
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  variant: z.string().optional(),
  compatible: z.coerce.boolean(),
  notes: z.string().optional(),
});

export async function addPhoneCompatibilityAction(formData: FormData) {
  const parsed = addEntrySchema.safeParse({
    productId: formData.get("productId"),
    manufacturer: formData.get("manufacturer"),
    model: formData.get("model"),
    variant: formData.get("variant"),
    compatible: formData.get("compatible") === "on",
    notes: formData.get("notes"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("product_phone_compatibility").insert({
    product_id: parsed.data.productId,
    manufacturer: parsed.data.manufacturer,
    model: parsed.data.model,
    variant: parsed.data.variant || null,
    compatible: parsed.data.compatible,
    notes: parsed.data.notes || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/products/${parsed.data.productId}/phone-compatibility`);
}

const deleteEntrySchema = z.object({
  id: uuidSchema,
  productId: uuidSchema,
});

export async function deletePhoneCompatibilityAction(formData: FormData) {
  const parsed = deleteEntrySchema.parse({
    id: formData.get("id"),
    productId: formData.get("productId"),
  });

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("product_phone_compatibility").delete().eq("id", parsed.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/products/${parsed.productId}/phone-compatibility`);
}

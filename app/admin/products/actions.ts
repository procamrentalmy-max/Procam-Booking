"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const createProductSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  internalName: z.string().min(1),
  customerFacingName: z.string().min(1),
  tagline: z.string().optional(),
  assetPrefix: z
    .string()
    .min(2)
    .max(6)
    .regex(/^[A-Za-z0-9]+$/, "Letters and numbers only"),
  usesBatteries: z.coerce.boolean(),
  requiresPhoneCompatibility: z.coerce.boolean(),
});

export async function createProductAction(formData: FormData) {
  const parsed = createProductSchema.safeParse({
    slug: formData.get("slug"),
    internalName: formData.get("internalName"),
    customerFacingName: formData.get("customerFacingName"),
    tagline: formData.get("tagline"),
    assetPrefix: formData.get("assetPrefix"),
    usesBatteries: formData.get("usesBatteries") === "on",
    requiresPhoneCompatibility: formData.get("requiresPhoneCompatibility") === "on",
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("rental_products").insert({
    slug: parsed.data.slug,
    internal_name: parsed.data.internalName,
    customer_facing_name: parsed.data.customerFacingName,
    tagline: parsed.data.tagline || null,
    asset_prefix: parsed.data.assetPrefix.toUpperCase(),
    uses_batteries: parsed.data.usesBatteries,
    requires_phone_compatibility: parsed.data.requiresPhoneCompatibility,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/products");
}

const updateProductSchema = z.object({
  id: z.string().uuid(),
  customerFacingName: z.string().min(1),
  tagline: z.string().optional(),
  usesBatteries: z.coerce.boolean(),
  requiresPhoneCompatibility: z.coerce.boolean(),
  active: z.coerce.boolean(),
});

export async function updateProductAction(formData: FormData) {
  const parsed = updateProductSchema.safeParse({
    id: formData.get("id"),
    customerFacingName: formData.get("customerFacingName"),
    tagline: formData.get("tagline"),
    usesBatteries: formData.get("usesBatteries") === "on",
    requiresPhoneCompatibility: formData.get("requiresPhoneCompatibility") === "on",
    active: formData.get("active") === "on",
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("rental_products")
    .update({
      customer_facing_name: parsed.data.customerFacingName,
      tagline: parsed.data.tagline || null,
      uses_batteries: parsed.data.usesBatteries,
      requires_phone_compatibility: parsed.data.requiresPhoneCompatibility,
      active: parsed.data.active,
    })
    .eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/products");
}

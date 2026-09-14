"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { productImagePath, uploadProductImage, deleteProductImage } from "@/lib/storage";

const categorySchema = z.enum(["DRONE", "CAMERA"]);

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
  category: categorySchema,
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
    category: formData.get("category"),
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
    category: parsed.data.category,
    uses_batteries: parsed.data.usesBatteries,
    requires_phone_compatibility: parsed.data.requiresPhoneCompatibility,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/products");
}

const updateProductSchema = z.object({
  id: uuidSchema,
  customerFacingName: z.string().min(1),
  tagline: z.string().optional(),
  category: categorySchema,
  usesBatteries: z.coerce.boolean(),
  requiresPhoneCompatibility: z.coerce.boolean(),
  active: z.coerce.boolean(),
});

export async function updateProductAction(formData: FormData) {
  const parsed = updateProductSchema.safeParse({
    id: formData.get("id"),
    customerFacingName: formData.get("customerFacingName"),
    tagline: formData.get("tagline"),
    category: formData.get("category"),
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
      category: parsed.data.category,
      uses_batteries: parsed.data.usesBatteries,
      requires_phone_compatibility: parsed.data.requiresPhoneCompatibility,
      active: parsed.data.active,
    })
    .eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/products");
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function updateProductImageAction(formData: FormData) {
  const id = uuidSchema.parse(formData.get("id"));
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a picture.");
  if (!ALLOWED_IMAGE_TYPES[file.type]) throw new Error("Picture must be a PNG, JPEG, or WebP image.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Picture must be under 5MB.");

  // Service-role, not the session-bound client the rest of this file uses —
  // Storage writes need it regardless, same as every other upload in the
  // app (uploadLogoAction, uploadEvidencePhoto, ...).
  const supabase = createServiceRoleClient();
  const path = productImagePath(id, file);
  await uploadProductImage(path, file);

  const { data: current } = await supabase.from("rental_products").select("image_path").eq("id", id).maybeSingle();
  const previousPath = current?.image_path;

  const { error } = await supabase.from("rental_products").update({ image_path: path }).eq("id", id);
  if (error) throw new Error(error.message);

  // Best-effort: the new picture is already live at this point, so a failed
  // cleanup of the old file (only relevant if the extension changed) is
  // stale storage, not a reason to fail the request.
  if (previousPath && previousPath !== path) {
    await deleteProductImage(previousPath).catch(() => {});
  }

  revalidatePath("/admin/products");
  revalidatePath("/p/[code]", "page");
}

export async function removeProductImageAction(formData: FormData) {
  const id = uuidSchema.parse(formData.get("id"));
  const supabase = createServiceRoleClient();

  const { data: current } = await supabase.from("rental_products").select("image_path").eq("id", id).maybeSingle();

  const { error } = await supabase.from("rental_products").update({ image_path: null }).eq("id", id);
  if (error) throw new Error(error.message);

  if (current?.image_path) {
    await deleteProductImage(current.image_path).catch(() => {});
  }

  revalidatePath("/admin/products");
  revalidatePath("/p/[code]", "page");
}

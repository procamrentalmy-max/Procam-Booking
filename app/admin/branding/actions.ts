"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { BRANDING_BUCKET } from "@/lib/branding";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const MAX_BYTES = 2 * 1024 * 1024;

export async function uploadLogoAction(formData: FormData) {
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a logo file.");
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new Error("Logo must be a PNG, JPEG, WebP, or SVG image.");
  if (file.size > MAX_BYTES) throw new Error("Logo must be under 2MB.");

  const supabase = createServiceRoleClient();
  const path = `logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BRANDING_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(`Failed to upload logo: ${uploadError.message}`);

  const { data: current } = await supabase.from("site_settings").select("logo_path").eq("id", 1).maybeSingle();
  const previousPath = current?.logo_path;

  const { error: updateError } = await supabase
    .from("site_settings")
    .update({ logo_path: path, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (updateError) throw new Error(`Failed to save logo: ${updateError.message}`);

  // Best-effort: the new logo is already live at this point, so a failed
  // cleanup of the old file is stale storage, not a reason to fail the request.
  if (previousPath && previousPath !== path) {
    await supabase.storage.from(BRANDING_BUCKET).remove([previousPath]).catch(() => {});
  }

  revalidatePath("/", "layout");
}

export async function removeLogoAction() {
  const supabase = createServiceRoleClient();
  const { data: current } = await supabase.from("site_settings").select("logo_path").eq("id", 1).maybeSingle();

  const { error } = await supabase
    .from("site_settings")
    .update({ logo_path: null, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(`Failed to remove logo: ${error.message}`);

  if (current?.logo_path) {
    await supabase.storage.from(BRANDING_BUCKET).remove([current.logo_path]).catch(() => {});
  }

  revalidatePath("/", "layout");
}

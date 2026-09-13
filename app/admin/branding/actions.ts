"use server";

import sharp from "sharp";
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

/**
 * Crops away uniform (typically transparent, since most uploaded logos have
 * their background removed) padding around the actual mark, so the logo
 * fills whatever box it's displayed in instead of floating in the middle of
 * empty canvas. SVGs are already scoped to their own viewBox and skip this —
 * only raster formats can have that kind of padding baked into their pixels.
 * Falls back to the original bytes if trimming fails (e.g. a logo that's a
 * single uniform color edge-to-edge, which sharp treats as "nothing to trim").
 */
async function trimPadding(buffer: Buffer, contentType: string): Promise<Buffer> {
  if (contentType === "image/svg+xml") return buffer;
  try {
    return await sharp(buffer).trim().toBuffer();
  } catch {
    return buffer;
  }
}

export async function uploadLogoAction(formData: FormData) {
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a logo file.");
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new Error("Logo must be a PNG, JPEG, WebP, or SVG image.");
  if (file.size > MAX_BYTES) throw new Error("Logo must be under 2MB.");

  const uploadBuffer = await trimPadding(Buffer.from(await file.arrayBuffer()), file.type);

  const supabase = createServiceRoleClient();
  const path = `logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BRANDING_BUCKET)
    .upload(path, uploadBuffer, { contentType: file.type, upsert: true });
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

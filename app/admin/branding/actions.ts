"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getAuthContext, isAdmin } from "@/lib/auth/session";
import { BRANDING_BUCKET, LANDING_IMAGE_COLUMN, LANDING_IMAGE_SLOTS, type LandingImageSlot } from "@/lib/branding";
import { ENABLED_DRONE_MODELS, comboKey, isControllerKind } from "@/lib/droneRental/pricingRules";

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

const MAX_PICTURE_BYTES = 8 * 1024 * 1024;
const PICTURE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
/** Pictures are shown at most about this wide, so bigger uploads are shrunk (phone photos are several thousand pixels across). */
const PICTURE_MAX_WIDTH = 1600;

function slotOf(formData: FormData): LandingImageSlot {
  const slot = formData.get("slot");
  if (!LANDING_IMAGE_SLOTS.includes(slot as LandingImageSlot)) throw new Error("Unknown picture.");
  return slot as LandingImageSlot;
}

/** A picture for the landing page (the top of the page, or beside "What is in the kit"), stored like the logo. */
export async function uploadLandingImageAction(formData: FormData) {
  const slot = slotOf(formData);
  const file = formData.get("picture");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a picture.");
  const ext = PICTURE_TYPES[file.type];
  if (!ext) throw new Error("The picture must be a PNG, JPEG or WebP image.");
  if (file.size > MAX_PICTURE_BYTES) throw new Error("The picture must be under 8MB.");

  // rotate() applies the phone's orientation tag before it is dropped, so a portrait photo doesn't end up on its side.
  const buffer = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .resize({ width: PICTURE_MAX_WIDTH, withoutEnlargement: true })
    .toBuffer();

  const supabase = createServiceRoleClient();
  const column = LANDING_IMAGE_COLUMN[slot];
  const path = `${slot}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BRANDING_BUCKET).upload(path, buffer, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(`Failed to upload the picture: ${uploadError.message}`);

  const { data: current } = await supabase.from("site_settings").select("hero_image_path,kit_image_path").eq("id", 1).maybeSingle();
  const previousPath = current?.[column];

  const { error: updateError } = await supabase
    .from("site_settings")
    .update({ ...(slot === "hero" ? { hero_image_path: path } : { kit_image_path: path }), updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (updateError) throw new Error(`Failed to save the picture: ${updateError.message}`);

  if (previousPath && previousPath !== path) await supabase.storage.from(BRANDING_BUCKET).remove([previousPath]).catch(() => {});
  revalidatePath("/", "layout");
}

/** Takes a landing picture away: the top of the page goes back to the drawn drone, the kit section to text only. */
export async function removeLandingImageAction(formData: FormData) {
  const slot = slotOf(formData);
  const column = LANDING_IMAGE_COLUMN[slot];
  const supabase = createServiceRoleClient();
  const { data: current } = await supabase.from("site_settings").select("hero_image_path,kit_image_path").eq("id", 1).maybeSingle();

  const { error } = await supabase
    .from("site_settings")
    .update({ ...(slot === "hero" ? { hero_image_path: null } : { kit_image_path: null }), updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(`Failed to remove the picture: ${error.message}`);

  const previousPath = current?.[column];
  if (previousPath) await supabase.storage.from(BRANDING_BUCKET).remove([previousPath]).catch(() => {});
  revalidatePath("/", "layout");
}

function comboOf(formData: FormData) {
  const model = String(formData.get("model"));
  const controller = formData.get("controller");
  const batteries = Number(formData.get("batteries"));
  if (!(ENABLED_DRONE_MODELS as readonly string[]).includes(model)) throw new Error("Unknown drone.");
  if (!isControllerKind(controller)) throw new Error("Unknown controller.");
  if (batteries !== 1 && batteries !== 2) throw new Error("Unknown battery choice.");
  return { model, controller, batteries };
}

/** The picture shown on the booking page for one drone / controller / batteries combination. */
export async function uploadComboPictureAction(formData: FormData) {
  if (!isAdmin(await getAuthContext())) throw new Error("Not authorized");
  const { model, controller, batteries } = comboOf(formData);
  const file = formData.get("picture");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a picture.");
  const ext = PICTURE_TYPES[file.type];
  if (!ext) throw new Error("The picture must be a PNG, JPEG or WebP image.");
  if (file.size > MAX_PICTURE_BYTES) throw new Error("The picture must be under 8MB.");

  const buffer = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .resize({ width: PICTURE_MAX_WIDTH, withoutEnlargement: true })
    .toBuffer();

  const supabase = createServiceRoleClient();
  const path = `combo-${comboKey(model, controller, batteries).replaceAll(":", "-")}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(BRANDING_BUCKET).upload(path, buffer, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(`Failed to upload the picture: ${uploadError.message}`);

  const { data: current } = await supabase.from("dr_combo_pictures").select("image_path").eq("drone_model", model).eq("controller_kind", controller).eq("batteries", batteries).maybeSingle();
  const { error } = await supabase
    .from("dr_combo_pictures")
    .upsert({ drone_model: model, controller_kind: controller, batteries, image_path: path, updated_at: new Date().toISOString() }, { onConflict: "drone_model,controller_kind,batteries" });
  if (error) throw new Error(`Failed to save the picture: ${error.message}`);

  if (current?.image_path && current.image_path !== path) await supabase.storage.from(BRANDING_BUCKET).remove([current.image_path]).catch(() => {});
  revalidatePath("/rent", "layout");
  revalidatePath("/admin/branding");
}

export async function removeComboPictureAction(formData: FormData) {
  if (!isAdmin(await getAuthContext())) throw new Error("Not authorized");
  const { model, controller, batteries } = comboOf(formData);
  const supabase = createServiceRoleClient();
  const { data: current } = await supabase.from("dr_combo_pictures").select("image_path").eq("drone_model", model).eq("controller_kind", controller).eq("batteries", batteries).maybeSingle();
  const { error } = await supabase.from("dr_combo_pictures").delete().eq("drone_model", model).eq("controller_kind", controller).eq("batteries", batteries);
  if (error) throw new Error(`Failed to remove the picture: ${error.message}`);
  if (current?.image_path) await supabase.storage.from(BRANDING_BUCKET).remove([current.image_path]).catch(() => {});
  revalidatePath("/rent", "layout");
  revalidatePath("/admin/branding");
}

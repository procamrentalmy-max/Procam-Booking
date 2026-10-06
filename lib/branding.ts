import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { comboKey } from "@/lib/droneRental/pricingRules";

export const BRANDING_BUCKET = "branding";

/** The uploaded logo's public URL, or null if the admin hasn't uploaded one yet — callers fall back to the default mark. */
export async function getLogoUrl(): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("site_settings").select("logo_path").eq("id", 1).maybeSingle();
  if (!data?.logo_path) return null;
  const { data: pub } = supabase.storage.from(BRANDING_BUCKET).getPublicUrl(data.logo_path);
  return pub.publicUrl;
}

export const LANDING_IMAGE_SLOTS = ["hero", "kit"] as const;
export type LandingImageSlot = (typeof LANDING_IMAGE_SLOTS)[number];

/** The settings column each landing picture is kept in. */
export const LANDING_IMAGE_COLUMN = { hero: "hero_image_path", kit: "kit_image_path" } as const;

/** The uploaded landing page pictures' public URLs; a slot is null until the admin uploads one. */
export async function getLandingImageUrls(): Promise<Record<LandingImageSlot, string | null>> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("site_settings").select("hero_image_path,kit_image_path").eq("id", 1).maybeSingle();
  const url = (path: string | null | undefined) => (path ? supabase.storage.from(BRANDING_BUCKET).getPublicUrl(path).data.publicUrl : null);
  return { hero: url(data?.hero_image_path), kit: url(data?.kit_image_path) };
}

/** The uploaded booking-page pictures' public URLs, by comboKey; a combination with no picture is missing from the result. */
export async function getComboPictureUrls(): Promise<Record<string, string>> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("dr_combo_pictures").select("drone_model,controller_kind,batteries,image_path");
  return Object.fromEntries(
    (data ?? []).map((r) => [comboKey(r.drone_model, r.controller_kind, r.batteries), supabase.storage.from(BRANDING_BUCKET).getPublicUrl(r.image_path).data.publicUrl])
  );
}

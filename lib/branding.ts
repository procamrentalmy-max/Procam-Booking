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

/** The uploaded picture of the QR a walk-in customer scans to pay, or null until the admin uploads one (paying by QR is then not offered). */
export async function getPayQrUrl(): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("site_settings").select("pay_qr_path").eq("id", 1).maybeSingle();
  if (!data?.pay_qr_path) return null;
  return supabase.storage.from(BRANDING_BUCKET).getPublicUrl(data.pay_qr_path).data.publicUrl;
}

/** How many pictures the flight tips page has: three places to fly and three to avoid, in rows of two (good on the left, avoid on the right). */
export const FLIGHT_TIP_COUNT = 6;
export const FLIGHT_TIP_FOLDER = "flight-tips";

/**
 * The six pictures of the flight tips page (shown before the payment and deposit page), by position 1 to 6, row by row. They are kept in the branding bucket as
 * flight-tips/tip-<n>-<time>.<ext>, so a slot with no file is null and the page shows its drawn icon instead.
 */
export async function getFlightTipUrls(): Promise<(string | null)[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.storage.from(BRANDING_BUCKET).list(FLIGHT_TIP_FOLDER, { limit: 100 });
  const urls: (string | null)[] = Array.from({ length: FLIGHT_TIP_COUNT }, () => null);
  for (const file of data ?? []) {
    const match = /^tip-(\d)-/.exec(file.name);
    const index = match ? Number(match[1]) - 1 : -1;
    if (index >= 0 && index < FLIGHT_TIP_COUNT) urls[index] = supabase.storage.from(BRANDING_BUCKET).getPublicUrl(`${FLIGHT_TIP_FOLDER}/${file.name}`).data.publicUrl;
  }
  return urls;
}

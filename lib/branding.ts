import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";

export const BRANDING_BUCKET = "branding";

/** The uploaded logo's public URL, or null if the admin hasn't uploaded one yet — callers fall back to the default mark. */
export async function getLogoUrl(): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("site_settings").select("logo_path").eq("id", 1).maybeSingle();
  if (!data?.logo_path) return null;
  const { data: pub } = supabase.storage.from(BRANDING_BUCKET).getPublicUrl(data.logo_path);
  return pub.publicUrl;
}

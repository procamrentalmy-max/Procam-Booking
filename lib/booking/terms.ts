import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";

export async function getActiveTermsVersion(
  productId: string
): Promise<{ id: string; body: string; version: number } | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("product_terms_versions")
    .select("id,body,version")
    .eq("product_id", productId)
    .eq("active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function recordBookingAcknowledgement(bookingId: string, termsVersionId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("booking_acknowledgements")
    .insert({ booking_id: bookingId, terms_version_id: termsVersionId });
  if (error) throw new Error(`Failed to record terms acknowledgement: ${error.message}`);
}

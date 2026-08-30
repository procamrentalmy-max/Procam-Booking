import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { CheckPhase, CheckTemplateRow } from "@/lib/db/types";

/** Active check-template items for a product/phase, in display order. */
export async function getCheckTemplates(productId: string, phase: CheckPhase): Promise<CheckTemplateRow[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("check_templates")
    .select("*")
    .eq("product_id", productId)
    .eq("phase", phase)
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

/** A booking's product_id, resolved via its rental package. */
export async function getBookingProductId(rentalPackageId: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("rental_packages").select("product_id").eq("id", rentalPackageId).single();
  return data?.product_id ?? null;
}

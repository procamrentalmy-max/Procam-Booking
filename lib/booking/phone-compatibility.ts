import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * A phone not found in the table is treated as NOT confirmed compatible —
 * the table can only ever cover phones someone entered, and shipping a
 * customer's own phone underwater on an unverified fit is the wrong side
 * to guess wrong on. An entry with variant = null acts as a wildcard for
 * "every variant of this model," checked when no exact variant match
 * exists, so admins don't have to enumerate every storage size/carrier
 * variant individually unless a specific one actually behaves differently.
 */
export async function isPhoneCompatible(
  productId: string,
  manufacturer: string,
  model: string,
  variant: string
): Promise<boolean> {
  const supabase = createServiceRoleClient();

  const { data: rows } = await supabase
    .from("product_phone_compatibility")
    .select("variant,compatible")
    .eq("product_id", productId)
    .ilike("manufacturer", manufacturer.trim())
    .ilike("model", model.trim());

  if (!rows || rows.length === 0) return false;

  const trimmedVariant = variant.trim().toLowerCase();
  const exactMatch = rows.find((r) => (r.variant ?? "").trim().toLowerCase() === trimmedVariant);
  if (exactMatch) return exactMatch.compatible;

  const wildcard = rows.find((r) => !r.variant);
  if (wildcard) return wildcard.compatible;

  return false;
}

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * Backstop for the primary mechanism (the per-partner sweep in
 * app/staff/route/actions.ts, which runs every time a worker services a
 * spot): if a hotel somehow goes uncollected past its destroy_by without a
 * fresh worker visit to trigger that sweep, this catches it on the same
 * wall-clock schedule. Moves the order into the wooden box (slot_number ->
 * null; status stays DELIVERED, nothing is discarded) so the slot is free
 * for reassignment either way.
 */
export async function expireUncollectedPickups(): Promise<{ boxed: number; errors: string[] }> {
  const supabase = createServiceRoleClient();
  const errors: string[] = [];

  const { data: overdue } = await supabase
    .from("photo_orders")
    .select("id")
    .eq("status", "DELIVERED")
    .not("slot_number", "is", null)
    .lt("destroy_by", new Date().toISOString());

  let boxed = 0;
  for (const order of overdue ?? []) {
    const { error } = await supabase
      .from("photo_orders")
      .update({ slot_number: null })
      .eq("id", order.id)
      .eq("status", "DELIVERED");
    if (error) {
      errors.push(`box photo order ${order.id}: ${error.message}`);
      continue;
    }
    boxed += 1;
  }

  return { boxed, errors };
}

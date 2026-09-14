import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { packageNeedsPowerBank, POWERBANK_COOLDOWN_MINUTES } from "./powerBankRules";

export { packageNeedsPowerBank };

/**
 * Best-effort: attaches one available power bank to the booking if the
 * package calls for one. "Available" is CHARGED outright, or CHARGING
 * (cooldown) whose cooldown has already lapsed. Deliberately never blocks
 * or fails the booking itself when the pool is empty — a bundled power
 * bank is a perk on top of the drone rental, not a hard requirement to
 * confirm the drone booking (unlike the drone/camera asset search, which
 * genuinely has no fleet-wide "next feasible slot" equivalent to fall
 * back to for this small an accessory pool).
 */
export async function assignPowerBankIfNeeded(
  supabase: SupabaseClient<Database>,
  bookingId: string,
  productSlug: string,
  durationMinutes: number
): Promise<void> {
  if (!packageNeedsPowerBank(productSlug, durationMinutes)) return;

  const now = new Date().toISOString();
  const { data: candidates } = await supabase
    .from("batteries")
    .select("id,human_id,status,cooldown_until")
    .in("status", ["CHARGED", "CHARGING"])
    .order("human_id", { ascending: true });

  const available = (candidates ?? []).find(
    (b) => b.status === "CHARGED" || (b.status === "CHARGING" && b.cooldown_until !== null && b.cooldown_until <= now)
  );
  if (!available) return;

  const { error: batteryError } = await supabase
    .from("batteries")
    .update({ status: "DEPLOYED", cooldown_until: null })
    .eq("id", available.id);
  if (batteryError) return;

  await supabase.from("bookings").update({ battery_id: available.id }).eq("id", bookingId);
}

/**
 * The other half of the pair: once a booking's power bank is physically
 * back (the customer's own return-condition-check submission, same signal
 * everything else about "is it back in the locker" relies on — see
 * app/r/[token]/return/actions.ts), it starts its cooldown instead of
 * going straight back into the assignable pool.
 */
export async function releasePowerBankForCooldown(supabase: SupabaseClient<Database>, batteryId: string): Promise<void> {
  const cooldownUntil = new Date(Date.now() + POWERBANK_COOLDOWN_MINUTES * 60_000).toISOString();
  await supabase.from("batteries").update({ status: "CHARGING", cooldown_until: cooldownUntil }).eq("id", batteryId);
}

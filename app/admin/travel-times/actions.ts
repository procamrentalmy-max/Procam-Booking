"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const PAIR_FIELD = /^pair_([0-9a-fA-F-]{36})_([0-9a-fA-F-]{36})$/;

/**
 * One field per unordered locker pair (`pair_<idA>_<idB>`) — a blank value
 * clears both directional rows back to the routing engine's 15-minute
 * default, a filled value upserts both directions to the same number
 * (real-world drive time between two points doesn't meaningfully differ by
 * direction in a small network, and asking the admin to enter it twice
 * would be pure friction).
 */
export async function updateTravelTimesAction(formData: FormData) {
  const supabase = await createServerSupabaseClient();

  const toDelete: { from: string; to: string }[] = [];
  const toUpsert: { from_partner_id: string; to_partner_id: string; minutes: number }[] = [];

  for (const [key, rawValue] of formData.entries()) {
    const match = key.match(PAIR_FIELD);
    if (!match) continue;
    const [, idA, idB] = match;
    uuidSchema.parse(idA);
    uuidSchema.parse(idB);

    const value = String(rawValue).trim();
    if (value === "") {
      toDelete.push({ from: idA, to: idB }, { from: idB, to: idA });
      continue;
    }

    const minutes = z.coerce.number().int().positive().parse(value);
    toUpsert.push(
      { from_partner_id: idA, to_partner_id: idB, minutes },
      { from_partner_id: idB, to_partner_id: idA, minutes }
    );
  }

  for (const { from, to } of toDelete) {
    const { error } = await supabase
      .from("location_travel_times")
      .delete()
      .eq("from_partner_id", from)
      .eq("to_partner_id", to);
    if (error) throw new Error(error.message);
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("location_travel_times")
      .upsert(toUpsert, { onConflict: "from_partner_id,to_partner_id" });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/travel-times");
}

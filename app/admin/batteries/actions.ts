"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const uuidOrEmpty = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.string().uuid().safeParse(v).success, "Invalid partner");

export async function createBatteryAction(formData: FormData) {
  const parsed = z.object({ partnerId: uuidOrEmpty }).safeParse({ partnerId: formData.get("partnerId") });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("batteries").insert({ partner_id: parsed.data.partnerId, status: "CHARGED" });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/batteries");
}

const updateSchema = z.object({
  id: z.string().uuid(),
  partnerId: uuidOrEmpty,
  status: z.enum(["CHARGED", "DEPLOYED", "CHARGING", "MAINTENANCE", "LOST", "RETIRED"]),
});

export async function updateBatteryAction(formData: FormData) {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    partnerId: formData.get("partnerId"),
    status: formData.get("status"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("batteries")
    .update({ partner_id: parsed.data.partnerId, status: parsed.data.status })
    .eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/batteries");
}

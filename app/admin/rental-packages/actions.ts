"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const packageSchema = z.object({
  name: z.string().min(1),
  durationMinutes: z.coerce.number().int().positive(),
  priceMyr: z.coerce.number().min(0),
  depositMyr: z.coerce.number().min(0),
  lateFeePerHourMyr: z.coerce.number().min(0),
});

export async function createRentalPackageAction(formData: FormData) {
  const parsed = packageSchema.safeParse({
    name: formData.get("name"),
    durationMinutes: formData.get("durationMinutes"),
    priceMyr: formData.get("priceMyr"),
    depositMyr: formData.get("depositMyr"),
    lateFeePerHourMyr: formData.get("lateFeePerHourMyr"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("rental_packages").insert({
    name: parsed.data.name,
    duration_minutes: parsed.data.durationMinutes,
    price_myr: parsed.data.priceMyr,
    deposit_myr: parsed.data.depositMyr,
    late_fee_per_hour_myr: parsed.data.lateFeePerHourMyr,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/rental-packages");
}

const updateSchema = packageSchema.extend({
  id: z.string().uuid(),
  active: z.coerce.boolean(),
});

export async function updateRentalPackageAction(formData: FormData) {
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    durationMinutes: formData.get("durationMinutes"),
    priceMyr: formData.get("priceMyr"),
    depositMyr: formData.get("depositMyr"),
    lateFeePerHourMyr: formData.get("lateFeePerHourMyr"),
    active: formData.get("active") === "on",
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("rental_packages")
    .update({
      name: parsed.data.name,
      duration_minutes: parsed.data.durationMinutes,
      price_myr: parsed.data.priceMyr,
      deposit_myr: parsed.data.depositMyr,
      late_fee_per_hour_myr: parsed.data.lateFeePerHourMyr,
      active: parsed.data.active,
    })
    .eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/rental-packages");
}

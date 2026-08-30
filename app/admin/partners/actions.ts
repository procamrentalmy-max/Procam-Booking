"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const createPartnerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  commissionRate: z.coerce.number().min(0).max(1),
  referralCode: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[A-Za-z0-9]+$/, "Letters and numbers only"),
});

export async function createPartnerAction(formData: FormData) {
  const parsed = createPartnerSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    commissionRate: formData.get("commissionRate"),
    referralCode: formData.get("referralCode"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("partners").insert({
    name: parsed.data.name,
    address: parsed.data.address,
    commission_rate: parsed.data.commissionRate,
    referral_code: parsed.data.referralCode.toUpperCase(),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/partners");
}

const updatePartnerSchema = z.object({
  id: z.string().uuid(),
  commissionRate: z.coerce.number().min(0).max(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export async function updatePartnerAction(formData: FormData) {
  const parsed = updatePartnerSchema.safeParse({
    id: formData.get("id"),
    commissionRate: formData.get("commissionRate"),
    status: formData.get("status"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("partners")
    .update({ commission_rate: parsed.data.commissionRate, status: parsed.data.status })
    .eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/partners");
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
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
  googleMapsUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

export async function createPartnerAction(formData: FormData) {
  const parsed = createPartnerSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    commissionRate: formData.get("commissionRate"),
    referralCode: formData.get("referralCode"),
    googleMapsUrl: formData.get("googleMapsUrl"),
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
    google_maps_url: parsed.data.googleMapsUrl || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/partners");
}

const updatePartnerSchema = z.object({
  id: uuidSchema,
  commissionRate: z.coerce.number().min(0).max(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  googleMapsUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

export async function updatePartnerAction(formData: FormData) {
  const parsed = updatePartnerSchema.safeParse({
    id: formData.get("id"),
    commissionRate: formData.get("commissionRate"),
    status: formData.get("status"),
    googleMapsUrl: formData.get("googleMapsUrl"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("partners")
    .update({
      commission_rate: parsed.data.commissionRate,
      status: parsed.data.status,
      google_maps_url: parsed.data.googleMapsUrl || null,
    })
    .eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/partners");
}

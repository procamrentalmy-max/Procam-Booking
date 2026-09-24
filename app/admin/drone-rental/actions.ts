"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const createShopSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  googleMapsUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

export async function createShopAction(formData: FormData) {
  const parsed = createShopSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    lat: formData.get("lat"),
    lng: formData.get("lng"),
    googleMapsUrl: formData.get("googleMapsUrl"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("dr_shops").insert({
    name: parsed.data.name,
    address: parsed.data.address,
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    google_maps_url: parsed.data.googleMapsUrl || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/drone-rental");
}

const setShopActiveSchema = z.object({ id: uuidSchema, active: z.enum(["true", "false"]).transform((v) => v === "true") });

export async function setShopActiveAction(formData: FormData) {
  const parsed = setShopActiveSchema.safeParse({ id: formData.get("id"), active: formData.get("active") });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("dr_shops").update({ active: parsed.data.active }).eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/drone-rental");
}

const createDroneSchema = z.object({
  shopId: uuidSchema,
  serialNumber: z.string().optional(),
  costPriceMyr: z.coerce.number().min(0),
});

/** Every drone ships with exactly 3 batteries (see pricingRules.ts's swap rule) — created alongside the drone, not managed separately. */
export async function createDroneAction(formData: FormData) {
  const parsed = createDroneSchema.safeParse({
    shopId: formData.get("shopId"),
    serialNumber: formData.get("serialNumber"),
    costPriceMyr: formData.get("costPriceMyr"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { data: drone, error } = await supabase
    .from("dr_drones")
    .insert({
      shop_id: parsed.data.shopId,
      serial_number: parsed.data.serialNumber || null,
      cost_price_myr: parsed.data.costPriceMyr,
    })
    .select("id")
    .single();
  if (error || !drone) throw new Error(error?.message ?? "Could not create the drone.");

  const { error: batteryError } = await supabase.from("dr_batteries").insert([{ drone_id: drone.id }, { drone_id: drone.id }, { drone_id: drone.id }]);
  if (batteryError) throw new Error(batteryError.message);

  revalidatePath("/admin/drone-rental");
}

const setDroneStatusSchema = z.object({ id: uuidSchema, status: z.enum(["AVAILABLE", "RENTED", "MAINTENANCE", "LOST", "RETIRED"]) });

export async function setDroneStatusAction(formData: FormData) {
  const parsed = setDroneStatusSchema.safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("dr_drones").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/drone-rental");
}

const assignMerchantSchema = z.object({ staffUserId: uuidSchema, shopIds: z.array(uuidSchema) });

/** Full-replace, same pattern as updateWorkerLockersAction in app/admin/staff/actions.ts. */
export async function assignMerchantShopsAction(formData: FormData) {
  const parsed = assignMerchantSchema.safeParse({ staffUserId: formData.get("staffUserId"), shopIds: formData.getAll("shopIds") });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();

  const { error: deleteError } = await supabase.from("dr_merchant_shops").delete().eq("staff_user_id", parsed.data.staffUserId);
  if (deleteError) throw new Error(deleteError.message);

  if (parsed.data.shopIds.length > 0) {
    const { error: insertError } = await supabase
      .from("dr_merchant_shops")
      .insert(parsed.data.shopIds.map((shopId) => ({ staff_user_id: parsed.data.staffUserId, shop_id: shopId })));
    if (insertError) throw new Error(insertError.message);
  }

  revalidatePath("/admin/drone-rental");
}

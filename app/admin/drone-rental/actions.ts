"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DRONE_MODELS, DRONE_MODEL_PROFILES } from "@/lib/droneRental/pricingRules";
import { nextBatteryNames } from "@/lib/droneRental/batteryNames";

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
  model: z.enum(DRONE_MODELS),
  serialNumber: z.string().optional(),
  costPriceMyr: z.coerce.number().min(0),
});

/** Every drone ships with exactly 3 batteries (see pricingRules.ts's swap rule) — created alongside the drone, not managed separately. */
export async function createDroneAction(formData: FormData) {
  const parsed = createDroneSchema.safeParse({
    shopId: formData.get("shopId"),
    model: formData.get("model"),
    serialNumber: formData.get("serialNumber"),
    costPriceMyr: formData.get("costPriceMyr"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { data: drone, error } = await supabase
    .from("dr_drones")
    .insert({
      shop_id: parsed.data.shopId,
      model_key: parsed.data.model,
      model: DRONE_MODEL_PROFILES[parsed.data.model].name,
      serial_number: parsed.data.serialNumber || null,
      cost_price_myr: parsed.data.costPriceMyr,
    })
    .select("id,human_id")
    .single();
  if (error || !drone) throw new Error(error?.message ?? "Could not create the drone.");

  // Every drone comes with a controller, numbered by make across all shops in the order added: CTD-001, CTD-002, ... for DJI controllers, CTG-001, ... for GT50.
  const { error: controllerError } = await supabase.from("dr_controllers").insert({ drone_id: drone.id });
  if (controllerError) throw new Error(controllerError.message);

  // Named by make (B1, B2... for the Neo 2, A1, A2... for the GT50), carrying on from the highest number already used
  // for that letter in this shop, so each battery can carry a matching sticker; rename them from this page.
  const { data: shopBatteries } = await supabase.from("dr_batteries").select("name").eq("shop_id", parsed.data.shopId);
  const names = nextBatteryNames((shopBatteries ?? []).map((b) => b.name), 3, DRONE_MODEL_PROFILES[parsed.data.model].batteryPrefix);
  const { error: batteryError } = await supabase.from("dr_batteries").insert(names.map((name) => ({ drone_id: drone.id, name })));
  if (batteryError) throw new Error(batteryError.code === "23505" ? "One of the new batteries' names is already taken in this shop. Rename it, then add the drone's batteries by hand." : batteryError.message);

  revalidatePath("/admin/drone-rental");
}

const renameBatterySchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1, "Enter a name for the battery").max(30, "Keep the name to 30 characters or fewer"),
});

/** Gives a battery the name on its sticker; shown to the merchant whenever it has to be handed out or taken back. */
export async function renameBatteryAction(formData: FormData) {
  const parsed = renameBatterySchema.safeParse({ id: formData.get("id"), name: formData.get("name") });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("dr_batteries").update({ name: parsed.data.name }).eq("id", parsed.data.id);
  if (error) throw new Error(error.code === "23505" ? "Another battery in this shop already has that name." : error.message);

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

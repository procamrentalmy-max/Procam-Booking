"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ENABLED_DRONE_MODELS, DRONE_MODEL_PROFILES } from "@/lib/droneRental/pricingRules";
import { nextBatteryNames } from "@/lib/droneRental/batteryNames";

/**
 * Admin > Drone Rental: the drones, batteries and controllers, and which shop each one is at. Shops themselves (name, address, opening hours) belong to each
 * Drone Merchant account and are edited under Admin > Staff. Actions here return `{ ok, error }` instead of throwing, because a thrown error never reaches the screen
 * on production: it shows the "page couldn't load" screen instead.
 */
export type InventoryResult = { ok: true } | { ok: false; error: string };

const firstIssue = (e: z.ZodError) => e.issues.map((i) => i.message).join(", ");

function refresh() {
  revalidatePath("/admin/drone-rental");
  revalidatePath("/admin/drone-rental/batteries");
  revalidatePath("/rent", "layout");
}

const createDroneSchema = z.object({
  shopId: uuidSchema,
  model: z.enum(ENABLED_DRONE_MODELS),
  serialNumber: z.string().optional(),
  djiAccount: z.string().trim().max(60).optional(),
  costPriceMyr: z.coerce.number().min(0),
});

/** Adds a drone to a shop. Batteries are added separately (and belong to a shop, not to the drone). */
export async function createDroneAction(formData: FormData): Promise<InventoryResult> {
  const parsed = createDroneSchema.safeParse({
    shopId: formData.get("shopId"),
    model: formData.get("model"),
    serialNumber: formData.get("serialNumber"),
    djiAccount: formData.get("djiAccount") ?? undefined,
    costPriceMyr: formData.get("costPriceMyr"),
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("dr_drones").insert({
    shop_id: parsed.data.shopId,
    model_key: parsed.data.model,
    model: DRONE_MODEL_PROFILES[parsed.data.model].name,
    serial_number: parsed.data.serialNumber || null,
    dji_account: parsed.data.djiAccount || null,
    cost_price_myr: parsed.data.costPriceMyr,
  });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

const droneDetailsSchema = z.object({ id: uuidSchema, serialNumber: z.string().trim().max(60), djiAccount: z.string().trim().max(60) });

/** A drone's serial number and the DJI account it is bound to: for the admin's own records, so they are on the drone's card and not only in a spreadsheet. */
export async function updateDroneDetailsAction(formData: FormData): Promise<InventoryResult> {
  const parsed = droneDetailsSchema.safeParse({ id: formData.get("id"), serialNumber: formData.get("serialNumber") ?? "", djiAccount: formData.get("djiAccount") ?? "" });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("dr_drones").update({ serial_number: parsed.data.serialNumber || null, dji_account: parsed.data.djiAccount || null }).eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

const moveDroneSchema = z.object({ id: uuidSchema, shopId: uuidSchema });

/** Moves a drone to another shop. Refused while the drone is out or has a booking waiting, so no customer is sent to a shop that no longer has it. */
export async function moveDroneAction(formData: FormData): Promise<InventoryResult> {
  const parsed = moveDroneSchema.safeParse({ id: formData.get("id"), shopId: formData.get("shopId") });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { data: drone } = await supabase.from("dr_drones").select("shop_id,status").eq("id", parsed.data.id).maybeSingle();
  if (!drone) return { ok: false, error: "That drone was not found." };
  if (drone.shop_id === parsed.data.shopId) return { ok: true };
  if (drone.status === "RENTED") return { ok: false, error: "This drone is out on a rental right now. Move it after it comes back." };
  const { count } = await supabase
    .from("dr_bookings")
    .select("id", { count: "exact", head: true })
    .eq("drone_id", parsed.data.id)
    .in("status", ["PENDING_PAYMENT", "CONFIRMED", "ACTIVE"]);
  if ((count ?? 0) > 0) return { ok: false, error: "This drone has a booking waiting. Move it after that booking is finished or cancelled." };

  const { error } = await supabase.from("dr_drones").update({ shop_id: parsed.data.shopId }).eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

const createBatteriesSchema = z.object({
  shopId: uuidSchema,
  model: z.enum(ENABLED_DRONE_MODELS),
  count: z.coerce.number().int().min(1, "Add at least 1 battery").max(30, "Add 30 batteries or fewer at a time"),
});

/**
 * Adds batteries to a shop. Each is named by make and numbered across ALL the shops (B1, B2... for the Neo 2), carrying on from the highest number already used,
 * because batteries are swapped between shops and every sticker number must be different. Rename them from this page.
 */
export async function createBatteriesAction(formData: FormData): Promise<InventoryResult> {
  const parsed = createBatteriesSchema.safeParse({ shopId: formData.get("shopId"), model: formData.get("model"), count: formData.get("count") });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { data: all } = await supabase.from("dr_batteries").select("name");
  const names = nextBatteryNames((all ?? []).map((b) => b.name), parsed.data.count, DRONE_MODEL_PROFILES[parsed.data.model].batteryPrefix);
  const { error } = await supabase.from("dr_batteries").insert(names.map((name) => ({ shop_id: parsed.data.shopId, model_key: parsed.data.model, name })));
  if (error) return { ok: false, error: error.code === "23505" ? "One of the new battery names is already taken. Rename that battery, then try again." : error.message };
  refresh();
  return { ok: true };
}

const assignBatterySchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1, "Enter a name for the battery").max(30, "Keep the name to 30 characters or fewer"),
  shopId: uuidSchema,
});

/** A battery's sticker name and the shop it belongs to. Changing the shop is only allowed while the battery is on that shop's shelf. */
export async function assignBatteryAction(formData: FormData): Promise<InventoryResult> {
  const parsed = assignBatterySchema.safeParse({ id: formData.get("id"), name: formData.get("name"), shopId: formData.get("shopId") });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { data: battery } = await supabase.from("dr_batteries").select("shop_id,at_shop_id,status").eq("id", parsed.data.id).maybeSingle();
  if (!battery) return { ok: false, error: "That battery was not found." };

  const changingShop = battery.shop_id !== parsed.data.shopId;
  if (changingShop && (battery.status !== "AT_SHOP" || battery.at_shop_id !== battery.shop_id)) {
    return { ok: false, error: "This battery is not on its shop's shelf right now (it is out on a rental or away from home). Move it after it is back." };
  }
  const { error } = await supabase
    .from("dr_batteries")
    .update(changingShop ? { name: parsed.data.name, shop_id: parsed.data.shopId, at_shop_id: parsed.data.shopId } : { name: parsed.data.name })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.code === "23505" ? "Another battery already has that name: every battery needs its own number." : error.message };
  refresh();
  return { ok: true };
}

const createControllerSchema = z.object({
  shopId: uuidSchema,
  kind: z.enum(["RC_N3", "GOGGLES_N3"]),
});

/** Adds a controller to a shop's pool: an RC-N3 (CTR-001, ...) or a Goggles N3 + Motion 3 set (GOG-001, ...). Customers can only pick what the shop has. */
export async function createControllerAction(formData: FormData): Promise<InventoryResult> {
  const parsed = createControllerSchema.safeParse({ shopId: formData.get("shopId"), kind: formData.get("kind") });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("dr_controllers").insert({ shop_id: parsed.data.shopId, kind: parsed.data.kind });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

/** Removes a controller that has never been on a booking (one that has is kept for the records; mark a lost one in the notes instead). */
export async function deleteControllerAction(formData: FormData): Promise<InventoryResult> {
  const parsed = z.object({ id: uuidSchema }).safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("dr_controllers").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.code === "23503" ? "This controller has been on a booking, so it can't be removed." : error.message };
  refresh();
  return { ok: true };
}

const setDroneStatusSchema = z.object({ id: uuidSchema, status: z.enum(["AVAILABLE", "RENTED", "MAINTENANCE", "LOST", "RETIRED"]) });

export async function setDroneStatusAction(formData: FormData): Promise<InventoryResult> {
  const parsed = setDroneStatusSchema.safeParse({ id: formData.get("id"), status: formData.get("status") });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("dr_drones").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

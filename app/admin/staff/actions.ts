"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { getAuthContext, isAdmin } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isValidUsername, usernameToEmail } from "@/lib/auth/username";
import { isHalfHourTime, serializeShopHours, WEEKDAY_NAMES, type ShopHours } from "@/lib/droneRental/hours";
import { SHOP_ADDRESS_PLACEHOLDER, shopInfoComplete } from "@/lib/droneRental/shopInfo";

const createStaffSchema = z.object({
  name: z.string().min(1, "Name is required"),
  username: z
    .string()
    .refine(isValidUsername, "3-32 characters: letters, numbers, dots, underscores, hyphens only"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "PROCAM_STAFF", "DRONE_MERCHANT"]),
});

/**
 * Uses the service-role client because creating a Supabase Auth user
 * (auth.admin.createUser) requires it — RLS/is_admin() can't gate that call,
 * so the admin check below is the only thing standing in for it.
 */
export type StaffActionResult = { ok: true } | { ok: false; error: string };

/** What the admin reads when Supabase Auth refuses an account: plain words instead of its own wording. */
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already") && (m.includes("registered") || m.includes("exists"))) return "That username is already taken. Pick another one.";
  if (m.includes("password")) return "That password isn't accepted. Try a longer or less common one.";
  return message;
}

export async function createStaffAction(formData: FormData): Promise<StaffActionResult> {
  const ctx = await getAuthContext();
  if (!isAdmin(ctx)) return { ok: false, error: "Not authorized" };

  const parsed = createStaffSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const supabase = createServiceRoleClient();

  // A Drone Merchant account IS the shop: it is made together with one (kept closed to customers until its address is filled in under Edit info),
  // or it takes over a shop that has no merchant yet.
  const shopChoice = String(formData.get("shopChoice") ?? "new");
  let shopToLink: string | null = null;
  let shopCreated = false;
  if (parsed.data.role === "DRONE_MERCHANT" && shopChoice !== "new") {
    if (!uuidSchema.safeParse(shopChoice).success) return { ok: false, error: "Pick a shop from the list." };
    const [{ data: shop }, { count: taken }] = await Promise.all([
      supabase.from("dr_shops").select("id").eq("id", shopChoice).maybeSingle(),
      supabase.from("dr_merchant_shops").select("shop_id", { count: "exact", head: true }).eq("shop_id", shopChoice),
    ]);
    if (!shop) return { ok: false, error: "That shop was not found." };
    if ((taken ?? 0) > 0) return { ok: false, error: "That shop already has a merchant." };
    shopToLink = shop.id;
  }

  const { data: created, error: authError } = await supabase.auth.admin.createUser({
    email: usernameToEmail(parsed.data.username),
    password: parsed.data.password,
    email_confirm: true,
  });
  if (authError) return { ok: false, error: friendlyAuthError(authError.message) };

  const { data: staffRow, error: staffError } = await supabase
    .from("staff_users")
    .insert({
      auth_user_id: created.user.id,
      name: parsed.data.name,
      role: parsed.data.role,
    })
    .select("id")
    .single();
  if (staffError) {
    await supabase.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: staffError.message };
  }

  if (parsed.data.role === "DRONE_MERCHANT") {
    if (!shopToLink) {
      const { data: shop, error: shopError } = await supabase
        .from("dr_shops")
        .insert({ name: parsed.data.name, address: SHOP_ADDRESS_PLACEHOLDER, lat: 0, lng: 0, active: false })
        .select("id")
        .single();
      if (shopError || !shop) {
        await supabase.from("staff_users").delete().eq("id", staffRow.id);
        await supabase.auth.admin.deleteUser(created.user.id);
        return { ok: false, error: shopError?.message ?? "Could not create the shop." };
      }
      shopToLink = shop.id;
      shopCreated = true;
    }
    const { error: linkError } = await supabase.from("dr_merchant_shops").insert({ staff_user_id: staffRow.id, shop_id: shopToLink });
    if (linkError) {
      if (shopCreated) await supabase.from("dr_shops").delete().eq("id", shopToLink);
      await supabase.from("staff_users").delete().eq("id", staffRow.id);
      await supabase.auth.admin.deleteUser(created.user.id);
      return { ok: false, error: linkError.message };
    }
  }

  // Staff (not admin) also need a workers row, or the routing feature
  // ("My Next Stop" on /staff/route) tells them they're "not set up as a
  // worker yet" even though their login works fine.
  if (parsed.data.role === "PROCAM_STAFF") {
    const { error: workerError } = await supabase.from("workers").insert({ staff_user_id: staffRow.id });
    if (workerError) {
      await supabase.from("staff_users").delete().eq("id", staffRow.id);
      await supabase.auth.admin.deleteUser(created.user.id);
      return { ok: false, error: workerError.message };
    }
  }

  revalidatePath("/admin/staff");
  return { ok: true };
}

const shopInfoSchema = z.object({
  shopId: uuidSchema,
  name: z.string().trim().min(1, "The shop needs a name"),
  address: z.string().trim().min(1, "The shop needs an address"),
  lat: z.coerce.number().min(-90, "Latitude is between -90 and 90").max(90, "Latitude is between -90 and 90"),
  lng: z.coerce.number().min(-180, "Longitude is between -180 and 180").max(180, "Longitude is between -180 and 180"),
  googleMapsUrl: z.string().trim().url("Enter a valid Google Maps link, or leave it empty").optional().or(z.literal("")),
});

/**
 * Edit info under a Drone Merchant account: the shop's name, address, map position, Google Maps link, opening hours, and whether it is open to customers.
 * Opening hours: one line per weekday (Sunday first), closed or an opening and closing time on the half hour, Malaysia time; customers can only book inside them.
 */
export async function updateShopInfoAction(formData: FormData): Promise<StaffActionResult> {
  const ctx = await getAuthContext();
  if (!isAdmin(ctx)) return { ok: false, error: "Not authorized" };

  const parsed = shopInfoSchema.safeParse({
    shopId: formData.get("shopId"),
    name: formData.get("name"),
    address: formData.get("address"),
    lat: formData.get("lat"),
    lng: formData.get("lng"),
    googleMapsUrl: formData.get("googleMapsUrl") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  const hours: ShopHours = [];
  for (let day = 0; day < 7; day++) {
    if (formData.get(`closed-${day}`)) {
      hours.push(null);
      continue;
    }
    const open = formData.get(`open-${day}`);
    const close = formData.get(`close-${day}`);
    if (!isHalfHourTime(open) || !isHalfHourTime(close)) return { ok: false, error: `${WEEKDAY_NAMES[day]}: use times on the hour or half hour, for example 09:00 or 18:30.` };
    if (open >= close) return { ok: false, error: `${WEEKDAY_NAMES[day]}: closing must be after opening.` };
    hours.push({ open, close });
  }

  const active = formData.get("active") === "on";
  if (active && !shopInfoComplete({ address: parsed.data.address, lat: parsed.data.lat, lng: parsed.data.lng })) {
    return { ok: false, error: "To open the shop to customers, give its real address and its map position (latitude and longitude) first." };
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("dr_shops")
    .update({
      name: parsed.data.name,
      address: parsed.data.address,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      google_maps_url: parsed.data.googleMapsUrl || null,
      active,
      hours: serializeShopHours(hours),
    })
    .eq("id", parsed.data.shopId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/staff");
  revalidatePath("/admin/drone-rental");
  revalidatePath("/rent", "layout");
  return { ok: true };
}

const updateStaffCredentialsSchema = z.object({
  id: uuidSchema,
  authUserId: uuidSchema,
  identifier: z.string().min(1, "Required"),
  // "username" for normal staff (synthetic email under the hood); "email" only
  // for the rare account that still logs in with a real email (the admin).
  mode: z.enum(["username", "email"]),
  password: z.union([z.string().min(8, "Password must be at least 8 characters"), z.literal("")]),
});

/**
 * Workers never manage their own login — admin sets/changes their username
 * (or, for the admin's own real-email account, their email) and password
 * from this page. Password is left untouched when the field is submitted
 * blank.
 */
export async function updateStaffCredentialsAction(formData: FormData): Promise<StaffActionResult> {
  const ctx = await getAuthContext();
  if (!isAdmin(ctx)) return { ok: false, error: "Not authorized" };

  const parsed = updateStaffCredentialsSchema.safeParse({
    id: formData.get("id"),
    authUserId: formData.get("authUserId"),
    identifier: formData.get("identifier"),
    mode: formData.get("mode"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") };

  let email: string;
  if (parsed.data.mode === "username") {
    if (!isValidUsername(parsed.data.identifier)) {
      return { ok: false, error: "3-32 characters: letters, numbers, dots, underscores, hyphens only" };
    }
    email = usernameToEmail(parsed.data.identifier);
  } else {
    if (!z.string().email().safeParse(parsed.data.identifier).success) return { ok: false, error: "Enter a valid email" };
    email = parsed.data.identifier;
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.auth.admin.updateUserById(parsed.data.authUserId, {
    email,
    ...(parsed.data.password ? { password: parsed.data.password } : {}),
  });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };

  revalidatePath("/admin/staff");
  return { ok: true };
}

const updateWorkerLockersSchema = z.object({
  workerId: uuidSchema,
  partnerIds: z.array(uuidSchema),
});

/**
 * Full-replace: whatever's checked on the form becomes the worker's
 * complete set of assigned lockers. A worker with zero lockers assigned is
 * treated as covering every locker (see lib/worker/route.ts), so unchecking
 * everything just goes back to that default rather than leaving them with
 * nothing to do.
 */
export async function updateWorkerLockersAction(formData: FormData) {
  const ctx = await getAuthContext();
  if (!isAdmin(ctx)) throw new Error("Not authorized");

  const parsed = updateWorkerLockersSchema.safeParse({
    workerId: formData.get("workerId"),
    partnerIds: formData.getAll("partnerIds"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = createServiceRoleClient();

  const { error: deleteError } = await supabase
    .from("worker_locker_assignments")
    .delete()
    .eq("worker_id", parsed.data.workerId);
  if (deleteError) throw new Error(deleteError.message);

  if (parsed.data.partnerIds.length > 0) {
    const { error: insertError } = await supabase.from("worker_locker_assignments").insert(
      parsed.data.partnerIds.map((partnerId) => ({ worker_id: parsed.data.workerId, partner_id: partnerId }))
    );
    if (insertError) throw new Error(insertError.message);
  }

  revalidatePath("/admin/staff");
}

const setStaffActiveSchema = z.object({
  id: uuidSchema,
  active: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export async function setStaffActiveAction(formData: FormData) {
  const ctx = await getAuthContext();
  if (!isAdmin(ctx)) throw new Error("Not authorized");

  const parsed = setStaffActiveSchema.safeParse({
    id: formData.get("id"),
    active: formData.get("active"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("staff_users")
    .update({ active: parsed.data.active })
    .eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/staff");
}

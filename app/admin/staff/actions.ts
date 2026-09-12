"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uuidSchema } from "@/lib/zod-helpers";
import { getAuthContext, isAdmin } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isValidUsername, usernameToEmail } from "@/lib/auth/username";

const createStaffSchema = z.object({
  name: z.string().min(1, "Name is required"),
  username: z
    .string()
    .refine(isValidUsername, "3-32 characters: letters, numbers, dots, underscores, hyphens only"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "PROCAM_STAFF"]),
});

/**
 * Uses the service-role client because creating a Supabase Auth user
 * (auth.admin.createUser) requires it — RLS/is_admin() can't gate that call,
 * so the admin check below is the only thing standing in for it.
 */
export async function createStaffAction(formData: FormData) {
  const ctx = await getAuthContext();
  if (!isAdmin(ctx)) throw new Error("Not authorized");

  const parsed = createStaffSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  const supabase = createServiceRoleClient();

  const { data: created, error: authError } = await supabase.auth.admin.createUser({
    email: usernameToEmail(parsed.data.username),
    password: parsed.data.password,
    email_confirm: true,
  });
  if (authError) throw new Error(authError.message);

  const { error: staffError } = await supabase.from("staff_users").insert({
    auth_user_id: created.user.id,
    name: parsed.data.name,
    role: parsed.data.role,
  });
  if (staffError) {
    await supabase.auth.admin.deleteUser(created.user.id);
    throw new Error(staffError.message);
  }

  revalidatePath("/admin/staff");
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
export async function updateStaffCredentialsAction(formData: FormData) {
  const ctx = await getAuthContext();
  if (!isAdmin(ctx)) throw new Error("Not authorized");

  const parsed = updateStaffCredentialsSchema.safeParse({
    id: formData.get("id"),
    authUserId: formData.get("authUserId"),
    identifier: formData.get("identifier"),
    mode: formData.get("mode"),
    password: formData.get("password"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

  let email: string;
  if (parsed.data.mode === "username") {
    if (!isValidUsername(parsed.data.identifier)) {
      throw new Error("3-32 characters: letters, numbers, dots, underscores, hyphens only");
    }
    email = usernameToEmail(parsed.data.identifier);
  } else {
    if (!z.string().email().safeParse(parsed.data.identifier).success) throw new Error("Enter a valid email");
    email = parsed.data.identifier;
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.auth.admin.updateUserById(parsed.data.authUserId, {
    email,
    ...(parsed.data.password ? { password: parsed.data.password } : {}),
  });
  if (error) throw new Error(error.message);

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

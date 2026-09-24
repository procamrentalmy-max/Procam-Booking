import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Who is signed in, resolved server-side from the Supabase session cookie
 * plus a lookup against staff_users. This is the single place that answers
 * "what can this person do" — route layouts and server actions both call
 * this rather than re-deriving role from raw auth state.
 */
export type AuthContext =
  | { kind: "admin"; staffId: string; name: string }
  | { kind: "staff"; staffId: string; name: string }
  | { kind: "merchant"; staffId: string; name: string };

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staffRow } = await supabase
    .from("staff_users")
    .select("id,name,role,active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (staffRow && staffRow.active) {
    if (staffRow.role === "ADMIN") return { kind: "admin", staffId: staffRow.id, name: staffRow.name };
    if (staffRow.role === "DRONE_MERCHANT") return { kind: "merchant", staffId: staffRow.id, name: staffRow.name };
    return { kind: "staff", staffId: staffRow.id, name: staffRow.name };
  }

  return null;
}

export function isAdmin(ctx: AuthContext | null): ctx is Extract<AuthContext, { kind: "admin" }> {
  return ctx?.kind === "admin";
}

/** Admin has a superset of staff permissions (matches the is_procam_staff() RLS helper). */
export function hasStaffAccess(
  ctx: AuthContext | null
): ctx is Extract<AuthContext, { kind: "admin" | "staff" }> {
  return ctx?.kind === "admin" || ctx?.kind === "staff";
}

/** Admin has a superset of merchant permissions (matches the is_drone_merchant() RLS helper). */
export function hasMerchantAccess(
  ctx: AuthContext | null
): ctx is Extract<AuthContext, { kind: "admin" | "merchant" }> {
  return ctx?.kind === "admin" || ctx?.kind === "merchant";
}

export const ROLE_HOME: Record<AuthContext["kind"], string> = {
  admin: "/admin",
  staff: "/staff",
  merchant: "/merchant",
};

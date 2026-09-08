"use server";

import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * DEV ONLY — signs the browser in as the seeded ProCam Admin without a
 * password. Mints a magic-link token server-side with the service-role key
 * (never exposed to the client) and immediately verifies it against the
 * request-scoped client, which sets a REAL Supabase Auth session cookie —
 * every /staff and /admin page and server action works exactly as if
 * genuinely logged in (RLS's is_admin()/is_procam_staff() check the real
 * auth.uid(), so a fake app-layer context alone wouldn't be enough).
 *
 * Double-gated so it can never fire outside a local dev box: requires
 * NODE_ENV !== "production" AND an explicit DEV_BYPASS_LOGIN_EMAIL in
 * .env.local (gitignored, never committed).
 *
 * Delete this file and its button in app/login/page.tsx before launch.
 */
export async function devLoginAction(formData: FormData) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Dev login is disabled in production.");
  }
  const email = process.env.DEV_BYPASS_LOGIN_EMAIL;
  if (!email) throw new Error("Set DEV_BYPASS_LOGIN_EMAIL in .env.local to use the dev login bypass.");

  const serviceClient = createServiceRoleClient();
  const { data, error } = await serviceClient.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) {
    throw new Error(error?.message ?? "Could not generate a dev sign-in link.");
  }

  const supabase = await createServerSupabaseClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError) throw new Error(verifyError.message);

  const next = formData.get("next");
  redirect(typeof next === "string" && next ? `/post-login?next=${encodeURIComponent(next)}` : "/post-login");
}

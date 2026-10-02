"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  // "local" ends only THIS device's session. supabase-js's default scope is
  // "global", which would also log the same account out everywhere else —
  // bad when a shop's phone and tablet share one merchant login.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

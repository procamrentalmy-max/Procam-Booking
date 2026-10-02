"use server";

import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { usernameToEmail } from "@/lib/auth/username";

const signInSchema = z.object({
  identifier: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(200),
  next: z.string().max(500).nullable(),
});

/**
 * Signs in on the server, not in the browser. The session cookie then
 * arrives as a real Set-Cookie header with its full 400-day lifetime
 * (lib/supabase/cookieOptions.ts). Signing in from the browser instead
 * writes the cookie via document.cookie, and Safari/iOS caps script-written
 * cookies at 7 days of inactivity — so a phone left unused for a week would
 * quietly lose its login. Server-set cookies aren't subject to that cap.
 */
export async function signInAction(input: {
  identifier: string;
  password: string;
  next: string | null;
}): Promise<{ ok: true; redirectTo: string } | { ok: false }> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const email = parsed.data.identifier.includes("@") ? parsed.data.identifier : usernameToEmail(parsed.data.identifier);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
  if (error) return { ok: false };

  const next = parsed.data.next;
  return { ok: true, redirectTo: next ? `/post-login?next=${encodeURIComponent(next)}` : "/post-login" };
}

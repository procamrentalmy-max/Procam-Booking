import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/db/types";

/**
 * Request-scoped Supabase client that carries the caller's auth session
 * (staff/reception). RLS applies — this client can only see what the
 * signed-in user's policies allow. Use this everywhere except the small set
 * of privileged operations that need createServiceRoleClient().
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render; safe to ignore because
            // middleware refreshes the session on the next request.
          }
        },
      },
    }
  );
}

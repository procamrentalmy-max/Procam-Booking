import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/**
 * Service-role client. Bypasses Row Level Security entirely.
 *
 * This is the ONLY way customer-facing code touches the database, since
 * customers never hold a Supabase session (see lib/booking-token.ts). Every
 * call site using this client MUST re-validate authorization itself
 * (the booking secure_token, the state machine transition, etc.) before
 * writing — there is no RLS safety net here.
 *
 * Never import this from a Client Component or expose
 * SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

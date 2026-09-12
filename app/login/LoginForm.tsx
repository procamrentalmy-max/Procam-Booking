"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { usernameToEmail } from "@/lib/auth/username";
import { devLoginAction } from "./devActions";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const email = identifier.includes("@") ? identifier : usernameToEmail(identifier);
    const supabase = createBrowserSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError("Incorrect username/email or password.");
      setLoading(false);
      return;
    }

    const next = searchParams.get("next");
    router.push(next ? `/post-login?next=${encodeURIComponent(next)}` : "/post-login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <div className="w-full max-w-sm space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-black dark:text-zinc-50">ProCam Staff Login</h1>
            <p className="mt-1 text-sm text-zinc-500">Reception, ProCam staff, and admin sign in here.</p>
          </div>

          <div className="space-y-2">
            <input
              type="text"
              required
              autoComplete="username"
              placeholder="Username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black py-3 text-base font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* DEV ONLY — remove before launch. See app/login/devActions.ts. */}
        <form action={devLoginAction} className="border-t border-dashed border-amber-400 pt-4">
          <input type="hidden" name="next" value={searchParams.get("next") ?? ""} />
          <button
            type="submit"
            className="flex h-10 w-full items-center justify-center rounded-full border border-dashed border-amber-500 text-xs font-medium text-amber-700 dark:text-amber-400"
          >
            [DEV] Sign in as ProCam Admin
          </button>
        </form>
      </div>
    </div>
  );
}

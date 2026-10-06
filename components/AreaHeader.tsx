import Link from "next/link";
import { signOutAction } from "@/lib/auth/actions";
import { Brand } from "@/components/Brand";

export function AreaHeader({
  title,
  name,
  homeHref,
  nav,
  logoUrl,
}: {
  title: string;
  name: string;
  homeHref?: string;
  /** Replaces the plain "Home" link (the logo still goes to homeHref). */
  nav?: React.ReactNode;
  logoUrl: string | null;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div>
        <Brand logoUrl={logoUrl} href={homeHref ?? "/"} size={20} />
        <p className="mt-0.5 text-xs text-zinc-500">{title}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {nav ??
          (homeHref && (
            <Link href={homeHref} className="inline-flex min-h-10 items-center px-1 text-sm font-medium text-zinc-500 underline underline-offset-2">
              Home
            </Link>
          ))}
        <form action={signOutAction} className="flex items-center gap-3">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">{name}</span>
          <button type="submit" className="min-h-10 px-1 text-sm font-medium text-zinc-500 underline underline-offset-2">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

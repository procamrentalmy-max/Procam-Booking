import Link from "next/link";
import { signOutAction } from "@/lib/auth/actions";
import { Brand } from "@/components/Brand";

export function AreaHeader({
  title,
  name,
  homeHref,
  logoUrl,
}: {
  title: string;
  name: string;
  homeHref?: string;
  logoUrl: string | null;
}) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div>
        <Brand logoUrl={logoUrl} href={homeHref ?? "/"} size={20} />
        <p className="mt-0.5 text-xs text-zinc-500">{title}</p>
      </div>
      <div className="flex items-center gap-3">
        {homeHref && (
          <Link href={homeHref} className="text-sm font-medium text-zinc-500 underline underline-offset-2">
            Home
          </Link>
        )}
        <form action={signOutAction} className="flex items-center gap-3">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">{name}</span>
          <button type="submit" className="text-sm font-medium text-zinc-500 underline underline-offset-2">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

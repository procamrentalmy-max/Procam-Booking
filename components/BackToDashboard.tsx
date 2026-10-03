"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A visible way back on every page below the area's dashboard (the header's "Home" is easy to miss mid-task),
 * plus an optional page title looked up by path. Renders nothing on the dashboard itself.
 */
export function BackToDashboard({
  href,
  label = "Dashboard",
  titles,
}: {
  href: string;
  label?: string;
  titles?: Record<string, string>;
}) {
  const pathname = usePathname();
  if (pathname === href) return null;
  const title = titles?.[pathname];
  return (
    <div className="mb-1">
      <Link href={href} className="-ml-1 inline-flex min-h-10 items-center px-1 text-sm font-medium text-zinc-600 dark:text-zinc-400">
        ← {label}
      </Link>
      {title && <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{title}</h1>}
    </div>
  );
}

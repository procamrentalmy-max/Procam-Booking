"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Header link for the merchant area: "Shop income" everywhere, but on the income page itself it turns back into "Home". */
export function IncomeToggleLink() {
  const onIncome = usePathname().startsWith("/merchant/income");
  return (
    <Link
      href={onIncome ? "/merchant" : "/merchant/income"}
      className="inline-flex min-h-10 items-center px-1 text-sm font-medium text-zinc-500 underline underline-offset-2"
    >
      {onIncome ? "Home" : "Shop income"}
    </Link>
  );
}

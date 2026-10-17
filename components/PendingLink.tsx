"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { Spinner } from "./Spinner";

/** Dims the button and shows a spinner on it while the page it links to is loading. Must sit inside a Link. */
function Busy() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span data-busy role="status" aria-label="Loading" className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/45 text-white">
      <Spinner />
    </span>
  );
}

/**
 * A Link for buttons that take the customer to another page: once tapped, the button dims and spins until the next page has arrived, so
 * nobody wonders whether the tap worked. Use it for button-shaped links; plain text links stay ordinary Links.
 */
export function PendingLink({ children, className = "", ...rest }: ComponentProps<typeof Link>) {
  return (
    <Link {...rest} className={`relative has-[[data-busy]]:text-transparent ${className}`}>
      {children}
      <Busy />
    </Link>
  );
}

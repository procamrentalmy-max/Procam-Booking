"use client";

import { useState } from "react";
import Link from "next/link";

export type CategoryProduct = {
  id: string;
  href: string;
  name: string;
  tagline: string | null;
  imageUrl: string | null;
};

/** Collapsed by default — tapping the category name reveals its products, matching the "press to dropdown" landing page structure. */
export function CategorySection({ label, products }: { label: string; products: CategoryProduct[] }) {
  const [open, setOpen] = useState(false);
  if (products.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left font-medium text-black dark:text-zinc-50"
      >
        {label}
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={`h-4 w-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="space-y-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
          {products.map((product) => (
            <Link
              key={product.id}
              href={product.href}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
            >
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local asset
                <img src={product.imageUrl} alt="" className="h-14 w-14 flex-shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="h-14 w-14 flex-shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
              )}
              <div>
                <p className="font-medium text-black dark:text-zinc-50">{product.name}</p>
                {product.tagline && <p className="text-sm text-zinc-500">{product.tagline}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { inputClass } from "@/components/formStyles";

/** A search box over a long list of merchants: rows whose name or username does not contain what is typed are hidden. */
export function MerchantFilter({ children }: { children: React.ReactNode }) {
  const list = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<number | null>(null);

  function filter(text: string) {
    const q = text.trim().toLowerCase();
    let visible = 0;
    list.current?.querySelectorAll<HTMLElement>("[data-merchant]").forEach((row) => {
      const match = q === "" || (row.dataset.merchant ?? "").includes(q);
      row.hidden = !match;
      if (match) visible++;
    });
    setShown(q === "" ? null : visible);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input type="search" onChange={(e) => filter(e.target.value)} placeholder="Search by name or username" aria-label="Search merchants" className={`w-full max-w-sm ${inputClass}`} />
        {shown !== null && <span className="text-xs text-zinc-500">{shown} found</span>}
      </div>
      <div ref={list} className="space-y-3">
        {children}
      </div>
    </div>
  );
}

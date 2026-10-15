"use client";

import { useEffect, useRef } from "react";
import type { CompareData } from "@/lib/droneRental/compareTables";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";
import { CompareTable } from "./CompareTable";

/**
 * The Compare view: just the comparison table, with a Choose button under each column. Choosing one picks it and closes the view, so the
 * visitor goes back to where they were with their pick made. It is always dark, like the landing page's own tables.
 */
export function CompareDialog<K extends string>({
  open,
  onClose,
  data,
  value,
  unavailable = [],
  onChoose,
  locale = "en",
  unavailableText,
}: {
  open: boolean;
  onClose: () => void;
  data: CompareData<K>;
  value: K | null;
  /** Columns that can't be chosen here (a drone or controller the shop has none of). */
  unavailable?: readonly string[];
  /** What an unavailable column's button says; by default "Not at this shop". */
  unavailableText?: string;
  onChoose: (key: K) => void;
  locale?: Locale;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = droneText(locale).common;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // a tap on the dimmed area outside the panel closes it
        if (e.target === ref.current) onClose();
      }}
      className="m-auto max-h-[92vh] w-[min(64rem,94vw)] overflow-y-auto rounded-3xl border border-zinc-700 bg-zinc-950 p-0 text-zinc-50 backdrop:bg-black/70"
    >
      {open && (
        <div className="px-5 py-6 md:px-8 md:py-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{data.title}</h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-zinc-400">{data.sub}</p>
            </div>
            <button type="button" onClick={onClose} className="shrink-0 rounded-full border border-slate-400 bg-slate-700 px-4 py-2 text-sm font-semibold text-zinc-50 hover:bg-slate-600">
              {t.compareClose}
            </button>
          </div>
          <CompareTable
            heads={data.heads}
            groups={data.groups}
            label={data.label}
            choose={{
              selected: value === null ? null : data.keys.indexOf(value),
              unavailable: data.keys.map((k) => unavailable.includes(k)),
              onChoose: (i) => {
                onChoose(data.keys[i]);
                onClose();
              },
              chooseText: t.chooseThis,
              chosenText: t.chosen,
              unavailableText: unavailableText ?? t.notAtShop,
            }}
          />
          {data.source && <p className="mt-3 text-xs text-zinc-500">{data.source}</p>}
        </div>
      )}
    </dialog>
  );
}

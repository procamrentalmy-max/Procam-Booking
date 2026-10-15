"use client";

import { Fragment } from "react";
import type { TableGroup } from "@/lib/droneRental/compareTables";

/** The Choose buttons under the column names, for the Compare view that lets the visitor pick the one they like. */
export type CompareChoose = {
  /** Column i is chosen when `selected === i`; `unavailable[i]` columns can't be chosen. */
  selected: number | null;
  unavailable: boolean[];
  onChoose: (index: number) => void;
  chooseText: string;
  chosenText: string;
  unavailableText: string;
};

/**
 * A comparison table: one column per choice, rows grouped under a small heading. Each row is the label followed by one cell per column.
 * With `choose` it is the Compare view: it fits a phone without sideways scrolling, and the column names and their Choose buttons stay
 * at the top while the rows scroll under them.
 */
export function CompareTable({ heads, groups, label, choose }: { heads: string[]; groups: TableGroup[]; label: string; choose?: CompareChoose }) {
  const pad = choose ? "px-2 sm:px-4 md:px-6" : "px-4 md:px-6";
  return (
    <div className={choose ? "mt-6 rounded-2xl border border-zinc-800 bg-black" : "mt-8 overflow-x-auto rounded-2xl border border-zinc-800 bg-black"}>
      <table className={choose ? "w-full table-fixed border-collapse text-left text-xs sm:text-sm" : "w-full min-w-[26rem] border-collapse text-left text-sm"}>
        <thead className={choose ? "sticky top-0 z-10 bg-black" : undefined}>
          <tr className="border-b border-zinc-800">
            <th scope="col" className={`${pad} py-4 ${choose ? "w-[34%] sm:w-[30%]" : ""}`}>
              <span className="sr-only">{label}</span>
            </th>
            {heads.map((h) => (
              <th key={h} scope="col" className={`${pad} py-4 align-bottom text-sm font-semibold text-white sm:text-base md:text-lg`}>
                {h}
              </th>
            ))}
          </tr>
          {choose && (
            <tr className="border-b border-zinc-800">
              <td className={`${pad} pb-3`} />
              {heads.map((h, i) => {
                const off = choose.unavailable[i];
                const on = choose.selected === i;
                return (
                  <td key={h} className="px-1 pb-3 align-top sm:px-3">
                    <button
                      type="button"
                      disabled={off}
                      aria-pressed={on}
                      onClick={() => choose.onChoose(i)}
                      className={`w-full rounded-xl border px-1 py-2.5 text-xs font-semibold sm:px-3 sm:text-sm ${
                        off
                          ? "cursor-not-allowed border-slate-700 text-slate-500"
                          : on
                            ? "border-white bg-white text-black shadow-md shadow-black/30"
                            : "cursor-pointer border-slate-400 bg-slate-700 text-zinc-50 shadow-md shadow-black/30 transition hover:-translate-y-px hover:border-white hover:bg-slate-600"
                      }`}
                    >
                      {off ? choose.unavailableText : on ? choose.chosenText : choose.chooseText}
                    </button>
                  </td>
                );
              })}
            </tr>
          )}
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.title}>
              {g.title && (
                <tr className="border-b border-zinc-800 bg-zinc-950">
                  <th colSpan={heads.length + 1} className={`${pad} pb-2 pt-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500`}>
                    {g.title}
                  </th>
                </tr>
              )}
              {g.rows.map(([rowLabel, ...cells]) => (
                <tr key={rowLabel} className="border-b border-zinc-900 last:border-b-0">
                  <th scope="row" className={`${pad} py-3.5 text-left font-normal text-zinc-400`}>
                    {rowLabel}
                  </th>
                  {cells.map((cell, i) => (
                    <td key={i} className={`${pad} py-3.5 font-medium text-zinc-100`}>
                      {cell === "✓" ? <span className="text-emerald-400" aria-label="Yes">✓</span> : cell === "✗" ? <span className="text-zinc-500" aria-label="No">✗</span> : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

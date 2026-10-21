"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ActionForm } from "@/components/admin/ActionForm";
import { moveFleetItemsAction } from "@/app/admin/drone-rental/actions";

const FORM_ID = "fleet-bulk-move";

/**
 * The bar on the fleet page for moving many things at once. The tick boxes live in each card (name="item", form="fleet-bulk-move") and each location has a
 * "select all" box (data-select-all="<location id>" ticking every box inside data-fleet-group="<location id>"), so the page itself stays a plain server page;
 * this bar only counts what is ticked and sends it to one location.
 */
export function FleetBulkMove({ shopOptions }: { shopOptions: ReactNode }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const boxes = () => document.querySelectorAll<HTMLInputElement>(`input[name="item"][form="${FORM_ID}"]`);
    const recount = () => setCount([...boxes()].filter((b) => b.checked).length);
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement;
      const group = t.dataset?.selectAll;
      if (group) {
        for (const b of boxes()) if (b.closest(`[data-fleet-group="${group}"]`)) b.checked = t.checked;
      }
      recount();
    };
    // The form clears its ticks after a move: count again once that has happened.
    const onReset = () => setTimeout(recount, 0);
    document.addEventListener("change", onChange);
    document.addEventListener("reset", onReset);
    recount();
    return () => {
      document.removeEventListener("change", onChange);
      document.removeEventListener("reset", onReset);
    };
  }, []);

  function clearTicks() {
    document.querySelectorAll<HTMLInputElement>(`input[form="${FORM_ID}"], input[data-select-all]`).forEach((b) => (b.checked = false));
    setCount(0);
  }

  return (
    <div className="sticky top-2 z-10 rounded-xl border border-zinc-300 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <ActionForm
        id={FORM_ID}
        action={moveFleetItemsAction}
        submitLabel="Move selected"
        savedText="Moved."
        resetOnSuccess
        compact
        className="flex flex-wrap items-center gap-2"
      >
        <span className="text-sm font-medium">{count === 0 ? "Tick drones, batteries or controllers to move them together" : `${count} selected`}</span>
        <select name="shopId" required defaultValue="" aria-label="Move the selected to" className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          <option value="">Move to…</option>
          {shopOptions}
        </select>
        {count > 0 && (
          <button type="button" onClick={clearTicks} className="text-sm underline underline-offset-2">
            Clear
          </button>
        )}
      </ActionForm>
    </div>
  );
}

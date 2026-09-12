"use client";

import { createContext, useContext, useState } from "react";

const EditModeContext = createContext(false);

/**
 * Wraps a listing page so its delete controls stay hidden until the admin
 * deliberately flips "Edit Mode" on — a plain Delete button sitting next to
 * every row is too easy to hit by accident. Server Component children (the
 * actual list, still fetched/rendered on the server) pass straight through.
 */
export function EditModeProvider({ children }: { children: React.ReactNode }) {
  const [editMode, setEditMode] = useState(false);

  return (
    <EditModeContext.Provider value={editMode}>
      <label className="mb-4 flex w-fit items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700">
        <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
        Edit Mode
        {editMode && <span className="text-red-600">— deleting is enabled</span>}
      </label>
      {children}
    </EditModeContext.Provider>
  );
}

/** Renders its children only while Edit Mode is on. */
export function DeleteGate({ children }: { children: React.ReactNode }) {
  const editMode = useContext(EditModeContext);
  if (!editMode) return null;
  return <>{children}</>;
}

"use client";

import { useState } from "react";
import { updateMyLocationAction } from "./actions";

export function UpdateLocationForm({
  lockers,
  currentPartnerId,
}: {
  lockers: { id: string; name: string }[];
  currentPartnerId: string | null;
}) {
  const [partnerId, setPartnerId] = useState(currentPartnerId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleUpdate() {
    if (!partnerId) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const formData = new FormData();
      formData.set("partnerId", partnerId);
      await updateMyLocationAction(formData);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md items-center gap-2 pt-4 text-sm">
      <select
        value={partnerId}
        onChange={(e) => {
          setPartnerId(e.target.value);
          setSaved(false);
        }}
        className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="" disabled>
          Where are you now?
        </option>
        {lockers.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <button
        onClick={handleUpdate}
        disabled={loading || !partnerId}
        className="rounded-lg border border-zinc-300 px-3 py-2 font-medium disabled:opacity-50 dark:border-zinc-700"
      >
        {loading ? "Updating…" : saved ? "Updated ✓" : "Update Location"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

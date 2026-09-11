"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CameraCaptureField } from "@/components/CameraCaptureField";
import { passInspectionAction, reportDamageAction } from "./actions";

const CAMERA_DAMAGE_CATEGORIES = [
  "LENS_SCRATCH",
  "SEVERE_LENS_DAMAGE",
  "SCREEN_DAMAGE",
  "BODY_DAMAGE",
  "WATER_DAMAGE",
  "MISSING_ACCESSORY",
  "MISSING_BATTERY",
  "CAMERA_MISSING",
  "FUNCTIONALITY_ISSUE",
  "OTHER",
] as const;

const SEALIFE_DAMAGE_CATEGORIES = [
  "HOUSING_CRACK",
  "OPTICAL_WINDOW_DAMAGE",
  "SEAL_ORING_FAILURE",
  "LOCKING_LATCH_DAMAGE",
  "VACUUM_SYSTEM_FAULT",
  "MOISTURE_LEAK_DETECTED",
  "CORROSION_SALT_DAMAGE",
  "MISSING_ACCESSORY",
  "HOUSING_MISSING",
  "FUNCTIONALITY_ISSUE",
  "OTHER",
] as const;

type PhotoItem = { key: string; label: string; preUrl?: string; returnUrl?: string };
type ChecklistItem = { key: string; label: string };

export function InspectionForm({
  assetId,
  assetHumanId,
  productSlug,
  productName,
  bookingId,
  bookingHumanId,
  photoItems,
  checklistItems,
  damageReported,
  damageDescription,
  lateFeeMyr,
}: {
  assetId: string;
  assetHumanId: string;
  productSlug: string;
  productName: string;
  bookingId: string;
  bookingHumanId: string;
  photoItems: PhotoItem[];
  checklistItems: ChecklistItem[];
  damageReported: boolean;
  damageDescription: string | null;
  lateFeeMyr: number;
}) {
  const router = useRouter();
  const damageCategories = productSlug.includes("sealife") ? SEALIFE_DAMAGE_CATEGORIES : CAMERA_DAMAGE_CATEGORIES;

  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    Object.fromEntries(checklistItems.map((i) => [i.key, true]))
  );
  const [notes, setNotes] = useState("");
  const [showDamageForm, setShowDamageForm] = useState(damageReported);
  const [category, setCategory] = useState<(typeof damageCategories)[number]>("OTHER");
  const [description, setDescription] = useState(damageDescription ?? "");
  const [damagePhotos, setDamagePhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function buildBaseFormData() {
    const fd = new FormData();
    fd.set("assetId", assetId);
    fd.set("bookingId", bookingId);
    fd.set("checklist", JSON.stringify(checklist));
    fd.set("notes", notes);
    return fd;
  }

  async function handlePass() {
    setError(null);
    setLoading(true);
    try {
      await passInspectionAction(buildBaseFormData());
      router.push("/staff/inspections");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  async function handleConfirmDamage() {
    setError(null);
    setLoading(true);
    try {
      const fd = buildBaseFormData();
      fd.set("category", category);
      fd.set("description", description);
      for (const file of damagePhotos) fd.append("damagePhotos", file);
      await reportDamageAction(fd);
      router.push("/staff/inspections");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 pt-4 pb-10">
      <h1 className="text-lg font-semibold">
        Inspect {assetHumanId} ({productName}) — Booking {bookingHumanId}
      </h1>

      {damageReported && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Customer reported an issue on return: {damageDescription}
        </div>
      )}

      {lateFeeMyr > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          This booking was returned late — RM{lateFeeMyr.toFixed(2)} will be captured from the deposit on Pass.
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500">Pre-Rental vs Return</h2>
        {photoItems.map((item) => (
          <div key={item.key} className="grid grid-cols-2 gap-2">
            <PhotoTile label={`${item.label} — Before`} url={item.preUrl} />
            <PhotoTile label={`${item.label} — After`} url={item.returnUrl} />
          </div>
        ))}
        {!photoItems.length && <p className="text-sm text-zinc-400">No condition photos configured for this product.</p>}
      </section>

      <section className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-500">Checklist</h2>
        {checklistItems.map((item) => (
          <label key={item.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={checklist[item.key]}
              onChange={(e) => setChecklist((prev) => ({ ...prev, [item.key]: e.target.checked }))}
            />
            {item.label}
          </label>
        ))}
        {!checklistItems.length && <p className="text-sm text-zinc-400">No inspection checklist configured for this product.</p>}
      </section>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Inspector notes (optional)"
        className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        rows={3}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!showDamageForm ? (
        <div className="flex gap-3">
          <button
            onClick={handlePass}
            disabled={loading}
            className="flex-1 rounded-full bg-green-600 py-3 font-semibold text-white disabled:opacity-50"
          >
            Pass
          </button>
          <button
            onClick={() => setShowDamageForm(true)}
            disabled={loading}
            className="flex-1 rounded-full border border-red-600 py-3 font-semibold text-red-600 disabled:opacity-50"
          >
            Damage / Issue
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-red-200 p-4">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {damageCategories.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the damage"
            className="w-full rounded-lg border border-zinc-300 px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            rows={3}
          />
          <CameraCaptureField photos={damagePhotos} onChange={setDamagePhotos} multiple />
          <button
            onClick={handleConfirmDamage}
            disabled={loading || !description}
            className="w-full rounded-full bg-red-600 py-3 font-semibold text-white disabled:opacity-50"
          >
            Confirm Damage — Send to Admin Review
          </button>
        </div>
      )}
    </div>
  );
}

function PhotoTile({ label, url }: { label: string; url?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-zinc-400">{label}</p>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not optimizable
        <img src={url} alt={label} className="aspect-square w-full rounded-lg object-cover" />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-900">
          No photo
        </div>
      )}
    </div>
  );
}

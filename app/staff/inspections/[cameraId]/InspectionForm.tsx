"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { passInspectionAction, reportDamageAction } from "./actions";

const CHECKLIST_ITEMS = [
  { key: "lensA", label: "Lens A" },
  { key: "lensB", label: "Lens B" },
  { key: "screen", label: "Screen" },
  { key: "buttons", label: "Buttons" },
  { key: "batteryCompartment", label: "Battery Compartment" },
  { key: "usbPort", label: "USB / Charging Port" },
  { key: "waterIngress", label: "No Water Ingress" },
  { key: "power", label: "Powers On" },
  { key: "recording", label: "Recording Works" },
  { key: "selfieStick", label: "Selfie Stick" },
  { key: "strap", label: "Wrist Strap" },
  { key: "case", label: "Case" },
] as const;

const DAMAGE_CATEGORIES = [
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

const PHOTO_TYPES = ["SCREEN_ON", "LENS_A", "LENS_B", "KIT_FULL"] as const;
const PHOTO_LABELS: Record<(typeof PHOTO_TYPES)[number], string> = {
  SCREEN_ON: "Screen On",
  LENS_A: "Lens A",
  LENS_B: "Lens B",
  KIT_FULL: "Full Kit",
};

export function InspectionForm({
  cameraId,
  cameraHumanId,
  bookingId,
  bookingHumanId,
  photos,
  damageReported,
  damageDescription,
}: {
  cameraId: string;
  cameraHumanId: string;
  bookingId: string;
  bookingHumanId: string;
  photos: Record<string, string>;
  damageReported: boolean;
  damageDescription: string | null;
}) {
  const router = useRouter();
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.key, true]))
  );
  const [notes, setNotes] = useState("");
  const [showDamageForm, setShowDamageForm] = useState(damageReported);
  const [category, setCategory] = useState<(typeof DAMAGE_CATEGORIES)[number]>("OTHER");
  const [description, setDescription] = useState(damageDescription ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function buildBaseFormData() {
    const fd = new FormData();
    fd.set("cameraId", cameraId);
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
        Inspect {cameraHumanId} — Booking {bookingHumanId}
      </h1>

      {damageReported && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Customer reported an issue on return: {damageDescription}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500">Pre-Rental vs Return</h2>
        {PHOTO_TYPES.map((type) => (
          <div key={type} className="grid grid-cols-2 gap-2">
            <PhotoTile label={`${PHOTO_LABELS[type]} — Before`} url={photos[`pre_${type}`]} />
            <PhotoTile label={`${PHOTO_LABELS[type]} — After`} url={photos[`return_${type}`]} />
          </div>
        ))}
      </section>

      <section className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-500">Checklist</h2>
        {CHECKLIST_ITEMS.map((item) => (
          <label key={item.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={checklist[item.key]}
              onChange={(e) => setChecklist((prev) => ({ ...prev, [item.key]: e.target.checked }))}
            />
            {item.label}
          </label>
        ))}
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
            {DAMAGE_CATEGORIES.map((c) => (
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

"use client";

import { useState } from "react";
import { CollagePanCrop, type PanCropValue } from "@/components/CollagePanCrop";
import { CELL_BOX_WIDTH, coverScale } from "@/lib/photoPrint/collageMath";
import { COLLAGE_TEMPLATES, COLLAGE_TEMPLATE_ORDER, printAspectRatio, type CollageTemplate } from "@/lib/photoPrint/templates";
import type { PhotoOrderSize } from "@/lib/db/types";
import type { Dictionary } from "@/lib/i18n/dictionaries";

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load that image."));
    };
    img.src = url;
  });
}

function LayoutIcon({ template }: { template: CollageTemplate }) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      {template === "SPLIT_H" && <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" />}
      {template === "SPLIT_V" && <line x1="12" y1="2" x2="12" y2="22" stroke="currentColor" strokeWidth="2" />}
    </svg>
  );
}

/**
 * The per-print editor: pick a layout (1 photo, or a max-2-photo collage),
 * add a photo per cell, pan/zoom each one to crop it, then flatten
 * everything into a single output image via canvas — like Instagram's
 * Layout app, but capped at 2 cells since more than that makes each photo
 * too small to be worth printing.
 */
export function CollageEditor({
  size,
  dict,
  onConfirm,
  onCancel,
}: {
  size: PhotoOrderSize;
  dict: Dictionary;
  onConfirm: (file: File) => void;
  onCancel: () => void;
}) {
  const t = dict.collageEditor;
  const [template, setTemplate] = useState<CollageTemplate>("SINGLE");
  const [cellFiles, setCellFiles] = useState<(File | null)[]>([null]);
  const [cellCrops, setCellCrops] = useState<(PanCropValue | null)[]>([null]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const printAspect = printAspectRatio(size);
  const cells = COLLAGE_TEMPLATES[template].cells;

  function selectTemplate(next: CollageTemplate) {
    setTemplate(next);
    const count = COLLAGE_TEMPLATES[next].cells.length;
    setCellFiles(Array.from({ length: count }, () => null));
    setCellCrops(Array.from({ length: count }, () => null));
    setError(null);
  }

  function setCellFile(index: number, file: File) {
    setCellFiles((prev) => prev.map((f, i) => (i === index ? file : f)));
    setCellCrops((prev) => prev.map((c, i) => (i === index ? null : c)));
  }

  function setCellCrop(index: number, crop: PanCropValue) {
    setCellCrops((prev) => prev.map((c, i) => (i === index ? crop : c)));
  }

  const ready = cellFiles.every((f) => f !== null) && cellCrops.every((c) => c !== null);

  async function handleConfirm() {
    if (!ready) return;
    setProcessing(true);
    setError(null);
    try {
      const OUTPUT_HEIGHT = 1500;
      const outputWidth = Math.round(OUTPUT_HEIGHT * printAspect);
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = OUTPUT_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("This device can't process photos.");

      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        const file = cellFiles[i]!;
        const crop = cellCrops[i]!;
        const img = await loadImage(file);

        const cellAspect = printAspect * (cell.width / cell.height);
        const boxWidth = CELL_BOX_WIDTH;
        const boxHeight = boxWidth / cellAspect;

        const cellPxX = cell.x * outputWidth;
        const cellPxY = cell.y * OUTPUT_HEIGHT;
        const cellPxW = cell.width * outputWidth;
        const cellPxH = cell.height * OUTPUT_HEIGHT;
        const factor = cellPxW / boxWidth;

        const scale = coverScale(boxWidth, boxHeight, crop.naturalWidth, crop.naturalHeight) * crop.zoom;
        const displayWidth = crop.naturalWidth * scale * factor;
        const displayHeight = crop.naturalHeight * scale * factor;
        const destX = cellPxX + crop.x * factor;
        const destY = cellPxY + crop.y * factor;

        ctx.save();
        ctx.beginPath();
        ctx.rect(cellPxX, cellPxY, cellPxW, cellPxH);
        ctx.clip();
        ctx.drawImage(img, destX, destY, displayWidth, displayHeight);
        ctx.restore();
      }

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error(t.compositeFailed);
      onConfirm(new File([blob], `print-${Date.now()}.jpg`, { type: "image/jpeg" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.compositeFailed);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-zinc-300 p-4 dark:border-zinc-700">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{t.chooseLayout}</p>
        <div className="flex gap-2">
          {COLLAGE_TEMPLATE_ORDER.map((tpl) => (
            <button
              key={tpl}
              type="button"
              onClick={() => selectTemplate(tpl)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-lg border py-2 text-xs font-medium ${
                template === tpl
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              <LayoutIcon template={tpl} />
              {tpl === "SINGLE" ? t.layoutSingle : tpl === "SPLIT_H" ? t.layoutSplitH : t.layoutSplitV}
            </button>
          ))}
        </div>
      </div>

      {COLLAGE_TEMPLATES[template].photoCount === 2 && (
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {t.twoPhotoWarning}
        </p>
      )}

      <div className={`flex gap-3 ${template === "SPLIT_H" ? "flex-col items-center" : "flex-row justify-center"}`}>
        {cells.map((cell, i) => {
          const cellAspect = printAspect * (cell.width / cell.height);
          const file = cellFiles[i];
          return (
            <div key={i}>
              {file ? (
                <CollagePanCrop
                  file={file}
                  aspect={cellAspect}
                  value={cellCrops[i]}
                  onChange={(v) => setCellCrop(i, v)}
                  boxWidth={CELL_BOX_WIDTH}
                  dragHint={t.dragHint}
                />
              ) : (
                <label
                  className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-zinc-300 text-xs text-zinc-400 dark:border-zinc-700"
                  style={{ width: CELL_BOX_WIDTH, height: CELL_BOX_WIDTH / cellAspect }}
                >
                  {t.addPhoto}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setCellFile(i, f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-full border border-zinc-300 py-2 text-sm font-medium dark:border-zinc-700"
        >
          {t.cancel}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!ready || processing}
          className="flex-1 rounded-full bg-black py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {processing ? t.processing : t.usePhoto}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { clampPosition, coverScale } from "@/lib/photoPrint/collageMath";

export type PanCropValue = {
  zoom: number;
  x: number;
  y: number;
  naturalWidth: number;
  naturalHeight: number;
};

/**
 * A single Instagram-Layout-style crop cell: drag to reposition, slider to
 * zoom, always fully covering the box (no gaps) — like every other photo
 * cropper, the image can be zoomed in past "fit" but never zoomed out past
 * "cover". Fully controlled: the parent (CollageEditor) owns `value` so it
 * can read every cell's crop state back out at composite time.
 */
export function CollagePanCrop({
  file,
  aspect,
  value,
  onChange,
  boxWidth = 240,
  dragHint,
}: {
  file: File;
  aspect: number;
  value: PanCropValue | null;
  onChange: (value: PanCropValue) => void;
  boxWidth?: number;
  dragHint?: string;
}) {
  const boxHeight = boxWidth / aspect;
  const objectUrlRef = useRef<string>("");
  const [objectUrl, setObjectUrl] = useState<string>("");
  const dragState = useRef<{ pointerId: number; startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );

  useEffect(() => {
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    if (value) return; // already initialized for this cell
    const naturalWidth = e.currentTarget.naturalWidth;
    const naturalHeight = e.currentTarget.naturalHeight;
    const scale = coverScale(boxWidth, boxHeight, naturalWidth, naturalHeight);
    const displayWidth = naturalWidth * scale;
    const displayHeight = naturalHeight * scale;
    onChange({
      zoom: 1,
      x: (boxWidth - displayWidth) / 2,
      y: (boxHeight - displayHeight) / 2,
      naturalWidth,
      naturalHeight,
    });
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!value) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origX: value.x, origY: value.y };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!value || !dragState.current || dragState.current.pointerId !== e.pointerId) return;
    const scale = coverScale(boxWidth, boxHeight, value.naturalWidth, value.naturalHeight) * value.zoom;
    const displayWidth = value.naturalWidth * scale;
    const displayHeight = value.naturalHeight * scale;
    const next = clampPosition(
      {
        x: dragState.current.origX + (e.clientX - dragState.current.startX),
        y: dragState.current.origY + (e.clientY - dragState.current.startY),
      },
      boxWidth,
      boxHeight,
      displayWidth,
      displayHeight
    );
    onChange({ ...value, ...next });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (dragState.current?.pointerId === e.pointerId) dragState.current = null;
  }

  function handleZoomChange(nextZoom: number) {
    if (!value) return;
    const scale = coverScale(boxWidth, boxHeight, value.naturalWidth, value.naturalHeight) * nextZoom;
    const displayWidth = value.naturalWidth * scale;
    const displayHeight = value.naturalHeight * scale;
    const next = clampPosition({ x: value.x, y: value.y }, boxWidth, boxHeight, displayWidth, displayHeight);
    onChange({ ...value, ...next, zoom: nextZoom });
  }

  const scale = value ? coverScale(boxWidth, boxHeight, value.naturalWidth, value.naturalHeight) * value.zoom : 1;

  return (
    <div className="space-y-1">
      <div
        className="relative touch-none overflow-hidden rounded-md border border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
        style={{ width: boxWidth, height: boxHeight }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {objectUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL, positioned by hand for cropping
          <img
            src={objectUrl}
            alt=""
            draggable={false}
            onLoad={handleImageLoad}
            className="absolute select-none"
            style={
              value
                ? {
                    left: value.x,
                    top: value.y,
                    width: value.naturalWidth * scale,
                    height: value.naturalHeight * scale,
                  }
                : { opacity: 0 }
            }
          />
        )}
        {dragHint && (
          <p className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
            {dragHint}
          </p>
        )}
      </div>
      {value && (
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={value.zoom}
          onChange={(e) => handleZoomChange(Number(e.target.value))}
          className="w-full"
          style={{ width: boxWidth }}
        />
      )}
    </div>
  );
}

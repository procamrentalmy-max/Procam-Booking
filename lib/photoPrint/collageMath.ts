/**
 * Shared between the live pan/zoom preview (components/CollagePanCrop.tsx)
 * and the final canvas composite (app/p/[code]/print/CollageEditor.tsx) —
 * both must agree on exactly the same cover-scale and clamping math, or
 * the printed result won't match what the customer saw while cropping.
 */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** The smallest scale that still lets the image fully cover the box — anything smaller would leave a gap. */
export function coverScale(boxWidth: number, boxHeight: number, naturalWidth: number, naturalHeight: number): number {
  return Math.max(boxWidth / naturalWidth, boxHeight / naturalHeight);
}

export function clampPosition(
  pos: { x: number; y: number },
  boxWidth: number,
  boxHeight: number,
  displayWidth: number,
  displayHeight: number
): { x: number; y: number } {
  return {
    x: clamp(pos.x, boxWidth - displayWidth, 0),
    y: clamp(pos.y, boxHeight - displayHeight, 0),
  };
}

/** Fixed reference width every cell's live crop box is rendered at — the composite step scales up from this same reference, so preview and output always agree. */
export const CELL_BOX_WIDTH = 240;

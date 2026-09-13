import type { PhotoOrderSize } from "@/lib/db/types";

export type CollageTemplate = "SINGLE" | "SPLIT_H" | "SPLIT_V";

/** A cell's position and size as a fraction (0..1) of the full print. */
export type CollageCell = { x: number; y: number; width: number; height: number };

export const COLLAGE_TEMPLATES: Record<
  CollageTemplate,
  { cells: CollageCell[]; photoCount: 1 | 2 }
> = {
  SINGLE: { cells: [{ x: 0, y: 0, width: 1, height: 1 }], photoCount: 1 },
  SPLIT_H: {
    cells: [
      { x: 0, y: 0, width: 1, height: 0.5 },
      { x: 0, y: 0.5, width: 1, height: 0.5 },
    ],
    photoCount: 2,
  },
  SPLIT_V: {
    cells: [
      { x: 0, y: 0, width: 0.5, height: 1 },
      { x: 0.5, y: 0, width: 0.5, height: 1 },
    ],
    photoCount: 2,
  },
};

export const COLLAGE_TEMPLATE_ORDER: CollageTemplate[] = ["SINGLE", "SPLIT_H", "SPLIT_V"];

/** Width / height of the physical print. Takes `size` for API stability (and in case a second size returns later) even though only 4R exists today. */
export function printAspectRatio(_size: PhotoOrderSize): number {
  return 4 / 6;
}

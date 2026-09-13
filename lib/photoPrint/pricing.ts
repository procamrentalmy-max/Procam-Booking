import type { PhotoOrderBilledTo, PhotoOrderQuantity, PhotoOrderSize } from "@/lib/db/types";

export const PHOTO_PRINT_SIZES: PhotoOrderSize[] = ["3R", "4R"];

/** Which print counts each size actually offers — not the same list for both: 4R moved from a 5-pack to a 7-pack, while 3R kept its original 5/10-pack lineup. */
export const PHOTO_PRINT_QUANTITIES_BY_SIZE: Record<PhotoOrderSize, PhotoOrderQuantity[]> = {
  "3R": [5, 10],
  "4R": [7, 10],
};

/** Whole-order guest retail price, set directly as a flat total per (size, quantity) rather than derived from a per-photo rate — avoids rounding drift now that a size's tiers aren't all priced off one per-unit rate. */
const GUEST_TOTAL_PRICE_MYR: Record<PhotoOrderSize, Partial<Record<PhotoOrderQuantity, number>>> = {
  "3R": { 5: 4.0, 10: 7.0 },
  "4R": { 7: 6.5, 10: 9.0 },
};

// Only 3R has an agreed hotel wholesale rate so far -- 4R has no
// complimentary tier yet and is always billed to the guest, even at a
// partnered hotel, until a 4R wholesale rate is set.
const HOTEL_TOTAL_PRICE_MYR: Partial<Record<PhotoOrderSize, Partial<Record<PhotoOrderQuantity, number>>>> = {
  "3R": { 5: 3.0, 10: 5.5 },
};

export type PhotoPrintQuote = {
  billedTo: PhotoOrderBilledTo;
  unitPriceMyr: number;
  totalPriceMyr: number;
};

export function quotePhotoPrint(
  size: PhotoOrderSize,
  quantity: PhotoOrderQuantity,
  partnerOffersComplimentary: boolean
): PhotoPrintQuote {
  const hotelTotal = partnerOffersComplimentary ? HOTEL_TOTAL_PRICE_MYR[size]?.[quantity] : undefined;
  if (hotelTotal !== undefined) {
    return { billedTo: "HOTEL", unitPriceMyr: round2(hotelTotal / quantity), totalPriceMyr: hotelTotal };
  }
  const guestTotal = GUEST_TOTAL_PRICE_MYR[size][quantity];
  if (guestTotal === undefined) {
    throw new Error(`${quantity} isn't an offered print count for ${size}`);
  }
  return { billedTo: "GUEST", unitPriceMyr: round2(guestTotal / quantity), totalPriceMyr: guestTotal };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

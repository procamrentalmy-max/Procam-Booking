import type { PhotoOrderBilledTo, PhotoOrderQuantity, PhotoOrderSize } from "@/lib/db/types";

/** 3R is discontinued — 4R is the only size offered. */
export const PHOTO_PRINT_SIZES: PhotoOrderSize[] = ["4R"];

/** Which print counts each size offers. */
export const PHOTO_PRINT_QUANTITIES_BY_SIZE: Record<PhotoOrderSize, PhotoOrderQuantity[]> = {
  "4R": [7, 10],
};

/** Whole-order guest retail price, set directly as a flat total per (size, quantity) rather than derived from a per-photo rate. */
const GUEST_TOTAL_PRICE_MYR: Record<PhotoOrderSize, Partial<Record<PhotoOrderQuantity, number>>> = {
  "4R": { 7: 6.5, 10: 9.0 },
};

// No 4R wholesale rate has been agreed with any hotel yet, so every order
// is guest-billed regardless of a partner's photo_print_complimentary flag
// — that flag only ever had a rate to apply against for the now-discontinued
// 3R. Left in place (empty) rather than removed, since the flag and this
// lookup are exactly what a future 4R wholesale rate would slot into.
const HOTEL_TOTAL_PRICE_MYR: Partial<Record<PhotoOrderSize, Partial<Record<PhotoOrderQuantity, number>>>> = {};

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

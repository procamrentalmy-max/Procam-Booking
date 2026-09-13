import type { PhotoOrderBilledTo, PhotoOrderQuantity, PhotoOrderSize } from "@/lib/db/types";

export const PHOTO_PRINT_SIZES: PhotoOrderSize[] = ["3R", "4R"];
export const PHOTO_PRINT_QUANTITIES: PhotoOrderQuantity[] = [5, 10];

const GUEST_UNIT_PRICE_MYR: Record<PhotoOrderSize, Record<PhotoOrderQuantity, number>> = {
  "3R": { 5: 0.8, 10: 0.7 },
  "4R": { 5: 0.9, 10: 0.75 },
};

// Only 3R has an agreed hotel wholesale rate so far -- 4R has no
// complimentary tier yet and is always billed to the guest, even at a
// partnered hotel, until a 4R wholesale rate is set.
const HOTEL_UNIT_PRICE_MYR: Partial<Record<PhotoOrderSize, Record<PhotoOrderQuantity, number>>> = {
  "3R": { 5: 0.6, 10: 0.55 },
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
  const hotelRate = partnerOffersComplimentary ? HOTEL_UNIT_PRICE_MYR[size]?.[quantity] : undefined;
  if (hotelRate !== undefined) {
    return { billedTo: "HOTEL", unitPriceMyr: hotelRate, totalPriceMyr: round2(hotelRate * quantity) };
  }
  const guestRate = GUEST_UNIT_PRICE_MYR[size][quantity];
  return { billedTo: "GUEST", unitPriceMyr: guestRate, totalPriceMyr: round2(guestRate * quantity) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

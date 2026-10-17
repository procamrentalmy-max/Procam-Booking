/**
 * The address a shop's walk-in QR points at. The shop's code (dr_shops.walkin_code) is permanent and the address is fixed here, not taken from
 * whatever page the QR is viewed on, so a QR printed once keeps working, wherever it was generated from. If the site ever moves to another
 * domain, set NEXT_PUBLIC_WALKIN_QR_ORIGIN and keep the old domain forwarding to it, or the printed QRs stop working.
 */
export const WALKIN_QR_ORIGIN = (process.env.NEXT_PUBLIC_WALKIN_QR_ORIGIN ?? "https://procambooking.app").replace(/\/$/, "");

export function walkInUrl(code: string): string {
  return `${WALKIN_QR_ORIGIN}/rent/walk-in/${code}`;
}

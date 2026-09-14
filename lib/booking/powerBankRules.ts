/** The only product a power bank currently bundles with. */
const DRONE_PRODUCT_SLUG = "dji-neo-2-mini-drone";

/** Below this duration the drone kit's own 2 batteries (30 min) are the whole story — no bundled power bank. */
const MIN_DURATION_MINUTES_FOR_POWERBANK = 180;

/** How long a returned power bank sits out before it can be assigned again. */
export const POWERBANK_COOLDOWN_MINUTES = 180;

/** Extra refundable hold on top of the package's own deposit, covering just the bundled power bank. */
export const POWERBANK_DEPOSIT_MYR = 100;

export function packageNeedsPowerBank(productSlug: string, durationMinutes: number): boolean {
  return productSlug === DRONE_PRODUCT_SLUG && durationMinutes >= MIN_DURATION_MINUTES_FOR_POWERBANK;
}

/**
 * The single source of truth for "how much deposit does this booking
 * actually hold" — the package's own amount, plus the power bank surcharge
 * whenever one either would be (pre-booking preview, via packageNeedsPowerBank)
 * or actually was (post-booking, via a real battery_id) attached.
 */
export function computeDepositTotalMyr(packageDepositMyr: number, hasPowerBank: boolean): number {
  return packageDepositMyr + (hasPowerBank ? POWERBANK_DEPOSIT_MYR : 0);
}

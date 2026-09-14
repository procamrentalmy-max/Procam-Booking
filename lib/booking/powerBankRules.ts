/** The only product a power bank currently bundles with. */
const DRONE_PRODUCT_SLUG = "dji-neo-2-mini-drone";

/** Below this duration the drone kit's own 2 batteries (30 min) are the whole story — no bundled power bank. */
const MIN_DURATION_MINUTES_FOR_POWERBANK = 180;

/** How long a returned power bank sits out before it can be assigned again. */
export const POWERBANK_COOLDOWN_MINUTES = 180;

export function packageNeedsPowerBank(productSlug: string, durationMinutes: number): boolean {
  return productSlug === DRONE_PRODUCT_SLUG && durationMinutes >= MIN_DURATION_MINUTES_FOR_POWERBANK;
}

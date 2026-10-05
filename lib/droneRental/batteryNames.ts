/**
 * Batteries are named B1, B2, B3, ... numbered separately inside each shop (see supabase/migrations/0046). A new
 * drone's batteries take the next numbers after the highest one already used in its shop, so names never repeat
 * and never fill gaps left by a removed battery.
 */
const NUMBERED = /^B(\d+)$/i;

/** The next `count` battery names for a shop that already has batteries called `existingNames` ("B1", "B2", renamed ones ignored). */
export function nextBatteryNames(existingNames: readonly (string | null)[], count: number): string[] {
  let highest = 0;
  for (const name of existingNames) {
    const match = name ? NUMBERED.exec(name.trim()) : null;
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return Array.from({ length: count }, (_, i) => `B${highest + 1 + i}`);
}

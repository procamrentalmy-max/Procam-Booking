/**
 * Batteries are named by make and numbered separately inside each shop (see supabase/migrations/0046): the Neo 2's
 * are B1, B2, B3, ... and the GT50's are A1, A2, A3, ... (they don't fit each other's drones, so the letter tells them
 * apart on the shelf). A new drone's batteries take the next numbers after the highest one already used for that
 * letter in its shop, so names never repeat and never fill gaps left by a removed battery.
 */

/** The next `count` battery names for a shop that already has batteries called `existingNames` (other letters and renamed ones are ignored). */
export function nextBatteryNames(existingNames: readonly (string | null)[], count: number, prefix = "B"): string[] {
  const numbered = new RegExp(`^${prefix}(\\d+)$`, "i");
  let highest = 0;
  for (const name of existingNames) {
    const match = name ? numbered.exec(name.trim()) : null;
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return Array.from({ length: count }, (_, i) => `${prefix}${highest + 1 + i}`);
}

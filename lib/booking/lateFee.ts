/**
 * Late fees are hourly, rounded up to the next full hour, with no grace
 * period — matches the "late_fee_per_hour_myr" column's own name (a flat
 * per-hour rate, not a per-minute or tiered one). Returning even a minute
 * after `scheduledEndTime` counts as one full hour late.
 */
export function computeLateFeeMyr(scheduledEndTime: Date, actualReturnTime: Date, lateFeePerHourMyr: number): number {
  if (actualReturnTime <= scheduledEndTime || lateFeePerHourMyr <= 0) return 0;
  const hoursLate = Math.ceil((actualReturnTime.getTime() - scheduledEndTime.getTime()) / (60 * 60 * 1000));
  return Math.round(hoursLate * lateFeePerHourMyr * 100) / 100;
}

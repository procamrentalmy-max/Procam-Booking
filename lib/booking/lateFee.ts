/**
 * Late fees are hourly, rounded up to the next full hour, after a flat
 * grace window — a return within `LATE_FEE_GRACE_MINUTES` of
 * `scheduledEndTime` isn't late at all. Once past grace, hours-late is
 * still measured from the real `scheduledEndTime`, not from the end of the
 * grace window — the grace period is a tolerance before any fee applies,
 * not a shifted deadline.
 */
export const LATE_FEE_GRACE_MINUTES = 25;

export function computeLateFeeMyr(scheduledEndTime: Date, actualReturnTime: Date, lateFeePerHourMyr: number): number {
  const graceDeadline = new Date(scheduledEndTime.getTime() + LATE_FEE_GRACE_MINUTES * 60_000);
  if (actualReturnTime <= graceDeadline || lateFeePerHourMyr <= 0) return 0;
  const hoursLate = Math.ceil((actualReturnTime.getTime() - scheduledEndTime.getTime()) / (60 * 60 * 1000));
  return Math.round(hoursLate * lateFeePerHourMyr * 100) / 100;
}

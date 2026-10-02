const MALAYSIA_TZ = "Asia/Kuala_Lumpur";

/** "42 min", "3h", "3h 12m" — how long, for countdowns and overdue labels. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  if (totalMinutes < 1) return "under 1 min";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** 24-hour wall-clock time in Malaysia, e.g. "19:30" — always Malaysia time, whatever the server's timezone. */
export function formatClock(date: Date): string {
  return date.toLocaleTimeString("en-GB", { timeZone: MALAYSIA_TZ, hour: "2-digit", minute: "2-digit", hour12: false });
}

function malaysiaDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: MALAYSIA_TZ });
}

/** "Today", "Tomorrow", or "02 Oct" — calendar days in Malaysia, not rolling 24-hour windows. */
export function formatDayLabel(date: Date, now: Date): string {
  const key = malaysiaDateKey(date);
  if (key === malaysiaDateKey(now)) return "Today";
  if (key === malaysiaDateKey(new Date(now.getTime() + 24 * 60 * 60_000))) return "Tomorrow";
  return date.toLocaleDateString("en-GB", { timeZone: MALAYSIA_TZ, day: "2-digit", month: "short" });
}

export type DueStatus = { label: string; overdue: boolean };

/** Where a rental stands against its return time: "42 min left" or "12 min overdue". */
export function describeDue(due: Date, now: Date): DueStatus {
  const diff = due.getTime() - now.getTime();
  return diff >= 0 ? { label: `${formatDuration(diff)} left`, overdue: false } : { label: `${formatDuration(-diff)} overdue`, overdue: true };
}

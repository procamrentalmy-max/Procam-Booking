/**
 * Small, dependency-free chart primitives for the sales page — plain CSS
 * bars and an SVG donut, no charting library. Everything here is a Server
 * Component (no interactivity needed: tooltips/zoom would be nice-to-have,
 * not necessary for a handful of admins glancing at monthly numbers), so it
 * costs nothing on the client bundle.
 */

const BAR_COLOR = "bg-black dark:bg-white";

export function BarChart({
  data,
  formatValue,
}: {
  data: { label: string; value: number }[];
  formatValue: (n: number) => string;
}) {
  if (!data.length) return <p className="text-sm text-zinc-400">No data yet.</p>;
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-zinc-500 sm:w-40" title={d.label}>
            {d.label}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
            <div className={`h-4 rounded ${BAR_COLOR}`} style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className="w-20 shrink-0 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
            {formatValue(d.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

const HEAT_LEVELS = [
  "bg-zinc-50 text-zinc-300 dark:bg-zinc-900 dark:text-zinc-700",
  "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100",
  "bg-emerald-400 text-white dark:bg-emerald-700",
  "bg-emerald-600 text-white dark:bg-emerald-500",
];

function heatLevel(intensity: number): string {
  if (intensity <= 0) return HEAT_LEVELS[0];
  if (intensity < 0.25) return HEAT_LEVELS[1];
  if (intensity < 0.5) return HEAT_LEVELS[2];
  if (intensity < 0.75) return HEAT_LEVELS[3];
  return HEAT_LEVELS[4];
}

/** Rows x columns grid, cell shade = value relative to the grid's own max — built for "which day sells best at which spot" at a glance. */
export function Heatmap({
  rowLabel,
  rows,
  columns,
  values,
  formatValue,
}: {
  rowLabel: string;
  rows: string[];
  columns: string[];
  values: number[][];
  formatValue: (n: number) => string;
}) {
  const max = Math.max(1, ...values.flat());

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 dark:bg-zinc-900">
            <th className="px-3 py-2 text-left font-medium text-zinc-500">{rowLabel}</th>
            {columns.map((c) => (
              <th key={c} className="px-1 py-2 text-center font-medium text-zinc-500">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r} className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="px-3 py-2 whitespace-nowrap">{r}</td>
              {values[i].map((v, j) => (
                <td key={j} className="p-1">
                  <div
                    className={`flex h-10 min-w-14 items-center justify-center rounded text-xs font-medium ${heatLevel(v / max)}`}
                  >
                    {v > 0 ? formatValue(v) : "—"}
                  </div>
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={columns.length + 1} className="px-3 py-3 text-center text-zinc-400">
                No data yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const DONUT_SLICE_CLASSES = [
  "stroke-zinc-900 dark:stroke-zinc-100",
  "stroke-zinc-400 dark:stroke-zinc-500",
  "stroke-emerald-500",
  "stroke-amber-500",
  "stroke-sky-500",
];

/** Small multi-way split (products, or anything else with few categories) — a bar chart of percentages would work too, but a donut reads "share of the whole" more immediately for 2-5 slices. */
export function DonutChart({
  data,
  formatValue,
}: {
  data: { label: string; value: number }[];
  formatValue: (n: number) => string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <p className="text-sm text-zinc-400">No data yet.</p>;

  const radius = 40;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;
  let offsetSoFar = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg viewBox="0 0 100 100" className="h-36 w-36 -rotate-90 shrink-0">
        {data.map((d, i) => {
          const fraction = d.value / total;
          const dash = fraction * circumference;
          const el = (
            <circle
              key={d.label}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offsetSoFar}
              className={DONUT_SLICE_CLASSES[i % DONUT_SLICE_CLASSES.length]}
            />
          );
          offsetSoFar += dash;
          return el;
        })}
      </svg>
      <ul className="space-y-1 text-sm">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${DONUT_SLICE_CLASSES[i % DONUT_SLICE_CLASSES.length].replace("stroke-", "bg-")}`}
            />
            <span className="text-zinc-700 dark:text-zinc-300">{d.label}</span>
            <span className="text-zinc-400">
              — {formatValue(d.value)} ({((d.value / total) * 100).toFixed(0)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

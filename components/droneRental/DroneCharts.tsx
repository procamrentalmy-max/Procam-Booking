/**
 * Chart pieces for the drone admin pages (Profit, Batteries): plain SVG and CSS, no charting library, all server-rendered.
 * Each one takes ready numbers and a formatter and draws them at whatever width it is given.
 */

const SERIES_FILL = ["fill-zinc-300 dark:fill-zinc-600", "fill-emerald-500", "fill-sky-500", "fill-amber-500"];
const SERIES_BG = ["bg-zinc-300 dark:bg-zinc-600", "bg-emerald-500", "bg-sky-500", "bg-amber-500"];

/** Short money for the tops of bars: RM1.2k, RM850. */
export function shortMyr(n: number): string {
  if (Math.abs(n) >= 1000) return `RM${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return `RM${Math.round(n)}`;
}

/** Vertical bars, one group per label and one bar per series (sales next to profit, say), with a value above each bar and a gridline scale. */
export function ColumnChart({
  labels,
  series,
  format = shortMyr,
  height = 180,
  showValues = labels.length <= 8,
}: {
  labels: string[];
  series: { name: string; values: number[] }[];
  format?: (n: number) => string;
  height?: number;
  /** The number under each label; left off when there are too many labels (twelve months) to fit them. */
  showValues?: boolean;
}) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const groupW = 100 / Math.max(1, labels.length);
  const barW = Math.min(8, (groupW * 0.72) / series.length);
  const top = 14;
  const plot = height - top - 22;
  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img">
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1="0" x2="100" y1={top + plot * (1 - f)} y2={top + plot * (1 - f)} className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
        ))}
        {labels.map((label, i) =>
          series.map((s, j) => {
            const v = s.values[i] ?? 0;
            const h = (v / max) * plot;
            const x = groupW * i + groupW / 2 - (barW * series.length) / 2 + barW * j;
            return <rect key={`${i}-${j}`} x={x} y={top + plot - h} width={barW * 0.92} height={Math.max(0, h)} rx="0.6" className={SERIES_FILL[(j + (series.length === 1 ? 1 : 0)) % SERIES_FILL.length]} />;
          }),
        )}
      </svg>
      <div className="mt-1 flex">
        {labels.map((label, i) => (
          <div key={label + i} className="min-w-0 flex-1 text-center text-[10px] leading-tight text-zinc-500">
            <div className="truncate">{label}</div>
            {showValues && <div className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{series.map((s) => format(s.values[i] ?? 0)).join(" · ")}</div>}
          </div>
        ))}
      </div>
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
          {series.map((s, j) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${SERIES_BG[j % SERIES_BG.length]}`} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Horizontal bars in rank order, a number badge on the left (gold, silver and bronze for the top three) and the value on the right. */
export function RankedBars({
  rows,
  format,
  emptyText = "Nothing to rank yet.",
}: {
  rows: { label: string; value: number; note?: string }[];
  format: (n: number) => string;
  emptyText?: string;
}) {
  if (!rows.length) return <p className="text-sm text-zinc-400">{emptyText}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const medal = ["bg-amber-400 text-black", "bg-zinc-300 text-black", "bg-orange-400 text-black"];
  return (
    <ol className="space-y-2">
      {rows.map((r, i) => (
        <li key={r.label} className="flex items-center gap-3 text-sm">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${medal[i] ?? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>{i + 1}</span>
          <span className="w-16 shrink-0 whitespace-nowrap font-semibold text-black dark:text-zinc-50">{r.label}</span>
          <div className="h-5 flex-1 overflow-hidden rounded bg-zinc-100 dark:bg-zinc-800">
            <div className={`h-5 rounded ${i === 0 ? "bg-emerald-500" : i < 3 ? "bg-emerald-400" : "bg-sky-400"}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="w-14 shrink-0 text-right font-semibold tabular-nums text-black dark:text-zinc-50">{format(r.value)}</span>
          {r.note && <span className="hidden w-24 shrink-0 text-xs text-zinc-500 sm:block">{r.note}</span>}
        </li>
      ))}
    </ol>
  );
}

/** One long bar showing how far along something is, with a marker at 100% (money earned back against what it cost). */
export function ProgressBar({ pct, label, sub }: { pct: number; label: string; sub?: string }) {
  const shown = Math.max(0, Math.min(100, pct));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium text-black dark:text-zinc-50">{label}</span>
        <span className="tabular-nums text-zinc-600 dark:text-zinc-400">{Math.round(pct)}%</span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className={`h-4 rounded-full ${pct >= 100 ? "bg-emerald-500" : "bg-sky-500"}`} style={{ width: `${shown}%` }} />
      </div>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

/** A big percentage on a half-circle dial with a tick at the target (the 65% profit goal). */
export function MarginDial({ value, target, label }: { value: number; target: number; label: string }) {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const arc = (f: number) => {
    const a = Math.PI * (1 - f);
    return `${50 + 40 * Math.cos(a)} ${50 - 40 * Math.sin(a)}`;
  };
  const onTrack = value >= target;
  return (
    <div className="text-center">
      <svg viewBox="0 0 100 58" className="mx-auto w-48">
        <path d={`M ${arc(0)} A 40 40 0 0 1 ${arc(1)}`} fill="none" strokeWidth="9" strokeLinecap="round" className="stroke-zinc-100 dark:stroke-zinc-800" />
        {value > 0 && <path d={`M ${arc(0)} A 40 40 0 0 1 ${arc(clamp(value))}`} fill="none" strokeWidth="9" strokeLinecap="round" className={onTrack ? "stroke-emerald-500" : "stroke-amber-500"} />}
        <line x1={50 + 33 * Math.cos(Math.PI * (1 - target))} y1={50 - 33 * Math.sin(Math.PI * (1 - target))} x2={50 + 47 * Math.cos(Math.PI * (1 - target))} y2={50 - 47 * Math.sin(Math.PI * (1 - target))} strokeWidth="1.2" className="stroke-black dark:stroke-white" />
        <text x="50" y="48" textAnchor="middle" className="fill-black text-[14px] font-semibold dark:fill-white">
          {Math.round(value * 100)}%
        </text>
      </svg>
      <p className="-mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

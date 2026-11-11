import { PendingLink } from "@/components/PendingLink";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";

/** A small drawn picture for each tip, 64 x 64. Same order as the text in `flightTips.good` and `flightTips.bad`. */
const DRONE = <path d="M10 22 30 16 22 26 28 34 8 28Z" fill="#374151" />;
const GOOD_ICONS = [
  // Well-lit area: a sun.
  <g key="sun">
    <circle cx="32" cy="32" r="11" fill="#fbbf24" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
      <line key={a} x1="32" y1="14" x2="32" y2="19" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" transform={`rotate(${a} 32 32)`} />
    ))}
  </g>,
  // Open area: a field with a tree and a stream.
  <g key="open">
    <path d="M6 54 18 34h40l-8 20Z" fill="#22a05a" />
    <path d="M22 50c10-2 14-8 18-14" stroke="#60a5fa" strokeWidth="3" fill="none" strokeLinecap="round" />
    <rect x="37" y="22" width="3" height="12" fill="#7c4a2d" />
    <path d="M38.5 8 31 22h15Z M38.5 14 29 28h19Z" fill="#166534" />
  </g>,
  // Clear and breezy weather: a pinwheel on grass.
  <g key="wind">
    <path d="M8 52c10-6 38-6 48 0v4H8Z" fill="#86efac" />
    <line x1="32" y1="30" x2="30" y2="52" stroke="#a16207" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M32 30V12a9 9 0 0 1 9 9Z M32 30h18a9 9 0 0 1-9 9Z M32 30v18a9 9 0 0 1-9-9Z M32 30H14a9 9 0 0 1 9-9Z" fill="#38bdf8" />
  </g>,
];
const BAD_ICONS = [
  // Textureless or reflective ground: a shiny tile floor.
  <g key="floor">
    <path d="M6 48 16 26h40l-8 22Z" fill="#e5e7eb" stroke="#cbd5e1" strokeWidth="1.5" />
    <path d="M26 26 22 48M40 26l-2 22M11 37h42" stroke="#cbd5e1" strokeWidth="1.2" />
    <path d="M14 10v8M10 14h8M26 6v5M23.5 8.5h5" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />
  </g>,
  // Bridge or balcony: a drone beside a ledge.
  <g key="ledge">
    {DRONE}
    <path d="M6 54V44h26V34h26v20Z" fill="#d1d5db" />
    <rect x="32" y="34" width="26" height="5" fill="#e5e7eb" />
  </g>,
  // Water: a drone above waves.
  <g key="water">
    {DRONE}
    <path d="M4 44c6-6 12-6 18 0s12 6 18 0 12-6 20 0v12H4Z" fill="#7dd3fc" />
    <path d="M4 52c6-6 12-6 18 0s12 6 18 0 12-6 20 0" stroke="#38bdf8" strokeWidth="2" fill="none" />
  </g>,
];

function Tip({ icon, label, good, aria, image }: { icon: React.ReactNode; label: string; good: boolean; aria: string; image?: string | null }) {
  // An uploaded picture is shown as it is (it carries its own tick or cross); without one, the drawn icon with its badge.
  if (image) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local optimizable asset */}
        <img src={image} alt={label} className="h-24 w-auto max-w-full object-contain" />
        <p className="text-xs leading-snug text-zinc-700 dark:text-zinc-300">{label}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative h-16 w-16">
        <svg viewBox="0 0 64 64" aria-hidden className="h-16 w-16">
          {icon}
        </svg>
        <span
          role="img"
          aria-label={aria}
          className={`absolute -bottom-1 -right-2 flex h-6 w-6 items-center justify-center rounded-full text-white ${good ? "bg-emerald-500" : "bg-red-500"}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            {good ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : <path d="M7 7l10 10M17 7 7 17" />}
          </svg>
        </span>
      </div>
      <p className="text-xs leading-snug text-zinc-700 dark:text-zinc-300">{label}</p>
    </div>
  );
}

/**
 * The page a customer sees before the payment and deposit screen: where it is safe to fly (good places on the left, places to avoid on the right).
 * "Got it" carries on to the payment through `continueHref`.
 */
export function FlightTips({ locale, continueHref, images = [] }: { locale: Locale; continueHref: string; /** The six uploaded pictures in order (row by row), null where there is none. */ images?: (string | null)[] }) {
  const t = droneText(locale).flightTips;
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{t.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t.sub}</p>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-7">
        {GOOD_ICONS.flatMap((good, i) => [
          <Tip key={`g${i}`} icon={good} label={t.good[i]} good aria={t.ok} image={images[i * 2]} />,
          <Tip key={`b${i}`} icon={BAD_ICONS[i]} label={t.bad[i]} good={false} aria={t.notOk} image={images[i * 2 + 1]} />,
        ])}
      </div>
      <p className="mt-auto text-center text-xs text-zinc-500">{t.windNote}</p>
      <PendingLink href={continueHref} className="flex h-12 w-full items-center justify-center rounded-full bg-black text-base font-semibold text-white dark:bg-white dark:text-black">
        {t.button}
      </PendingLink>
    </div>
  );
}

import Link from "next/link";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLogoUrl } from "@/lib/branding";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Brand } from "@/components/Brand";
import {
  ADDITIONAL_HOUR_RATE_MYR,
  BATTERY_SWAP_FEE_MYR,
  DEPOSIT_MYR,
  FIRST_HOUR_RATE_MYR,
  formatMyr,
} from "@/lib/droneRental/pricingRules";

/** The page is always dark (white and grey on black) whatever the visitor's theme, so it uses fixed colors rather than dark: variants. */

function DroneIllustration() {
  const props = [
    [62, 62],
    [238, 62],
    [62, 238],
    [238, 238],
  ];
  return (
    <svg viewBox="0 0 300 300" className="w-full max-w-sm" role="img" aria-label="A small camera drone seen from above">
      {[140, 110, 80].map((r, i) => (
        <circle key={r} cx="150" cy="150" r={r} fill="none" stroke="#fff" strokeOpacity={0.05 + i * 0.03} />
      ))}
      <g stroke="#52525b" strokeWidth="10" strokeLinecap="round">
        {props.map(([x, y]) => (
          <line key={`${x}-${y}`} x1="150" y1="150" x2={x} y2={y} />
        ))}
      </g>
      {props.map(([x, y]) => (
        <g key={`p-${x}-${y}`}>
          <circle cx={x} cy={y} r="38" fill="#18181b" stroke="#a1a1aa" strokeWidth="2" />
          <circle cx={x} cy={y} r="26" fill="none" stroke="#3f3f46" strokeWidth="1.5" strokeDasharray="4 6" />
          <circle cx={x} cy={y} r="5" fill="#e4e4e7" />
        </g>
      ))}
      <rect x="112" y="108" width="76" height="84" rx="22" fill="#27272a" stroke="#d4d4d8" strokeWidth="2" />
      <rect x="126" y="122" width="48" height="26" rx="10" fill="#09090b" stroke="#52525b" />
      <circle cx="150" cy="135" r="8" fill="#fafafa" fillOpacity="0.9" />
      <circle cx="150" cy="135" r="3" fill="#09090b" />
      <circle cx="150" cy="172" r="4" fill="#a1a1aa" />
    </svg>
  );
}

export default async function Home() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.home;
  const logoUrl = await getLogoUrl();

  // Prices come from the same constants the booking flow charges with, so this page can't drift from them.
  const fill = (text: string) =>
    text
      .replace("{first}", formatMyr(FIRST_HOUR_RATE_MYR))
      .replace("{extra}", formatMyr(ADDITIONAL_HOUR_RATE_MYR))
      .replace("{deposit}", formatMyr(DEPOSIT_MYR))
      .replace("{swap}", formatMyr(BATTERY_SWAP_FEE_MYR))
      .replace("{late}", formatMyr(ADDITIONAL_HOUR_RATE_MYR));

  return (
    <div className="min-h-screen bg-black text-zinc-50">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
        <Brand logoUrl={logoUrl} size={28} onDark />
        <div className="flex items-center gap-5 text-sm text-zinc-400">
          <Link href="/rent" className="hidden hover:text-white sm:inline">
            {t.nav.drones}
          </Link>
          <a href="#how" className="hidden hover:text-white sm:inline">
            {t.nav.howItWorks}
          </a>
          <LanguageToggle locale={locale} onDark />
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 pb-16 pt-10 md:grid-cols-[1.2fr_1fr] md:pb-24 md:pt-16">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">{t.eyebrow}</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl">
              {t.headline}
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-zinc-400">{t.sub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/rent"
                className="inline-flex h-12 items-center rounded-full bg-white px-7 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                {t.ctaPrimary}
              </Link>
              <a
                href="#how"
                className="inline-flex h-12 items-center rounded-full border border-zinc-700 px-7 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white"
              >
                {t.ctaSecondary}
              </a>
            </div>
          </div>
          <div className="flex justify-center rounded-3xl border border-zinc-800 bg-zinc-950 p-6 md:p-8">
            <DroneIllustration />
          </div>
        </section>

        <section className="border-y border-zinc-800 bg-zinc-950">
          <dl className="mx-auto grid max-w-5xl gap-8 px-6 py-10 sm:grid-cols-3">
            {t.stats.map((stat) => (
              <div key={stat.value}>
                <dt className="text-3xl font-semibold tracking-tight text-white">{fill(stat.value)}</dt>
                <dd className="mt-1 text-sm text-zinc-500">{fill(stat.label)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="how" className="mx-auto max-w-5xl scroll-mt-6 px-6 py-16 md:py-24">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t.stepsTitle}</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {t.steps.map((step, i) => (
              <li key={step.title} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 text-sm font-medium text-zinc-300">
                  {i + 1}
                </span>
                <p className="mt-4 text-base font-semibold text-white">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-16 md:pb-24">
          <div className="grid gap-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-8 md:grid-cols-2 md:p-10">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">{t.kitTitle}</h2>
              <ul className="mt-5 space-y-3">
                {t.kitItems.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-zinc-200">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-between gap-6">
              <p className="text-sm leading-relaxed text-zinc-400">{fill(t.kitNote)}</p>
              <Link
                href="/rent"
                className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                {t.ctaPrimary}
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-16">
          <div className="rounded-2xl border border-dashed border-zinc-800 p-6">
            <p className="text-sm font-semibold text-zinc-200">{t.camerasTitle}</p>
            <p className="mt-1 text-sm text-zinc-500">{t.camerasText}</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 text-xs text-zinc-600">
          <span>© ProCam Rental</span>
          <Link href="/terms" className="hover:text-zinc-300">
            {t.terms}
          </Link>
        </div>
      </footer>
    </div>
  );
}

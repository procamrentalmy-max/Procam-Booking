import Link from "next/link";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLogoUrl } from "@/lib/branding";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Brand } from "@/components/Brand";
import { DRONE_MODEL_PROFILES, depositMyrFor, formatMyr, type DroneModelProfile } from "@/lib/droneRental/pricingRules";

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

/** A tick (has it) or a cross (doesn't). Grey scale to match the page; the word is there for screen readers. */
function Mark({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return on ? (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-black" role="img" aria-label={yes}>
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 8.5l3.2 3.2L13 4.8" />
      </svg>
    </span>
  ) : (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-700 text-zinc-500" role="img" aria-label={no}>
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </span>
  );
}

export default async function Home() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.home;
  const logoUrl = await getLogoUrl();

  // Every price in the comparison comes from the same profiles the booking flow charges with, so this page can't drift from them.
  const c = t.compare;
  const neo2 = DRONE_MODEL_PROFILES.NEO2;
  const gt50 = DRONE_MODEL_PROFILES.GT50;
  const swapText = (p: DroneModelProfile) => c.swapValue.replace("{one}", formatMyr(p.batteryFeeMyr[1])).replace("{two}", formatMyr(p.batteryFeeMyr[2]));
  const compareRows: [string, string, string][] = [
    [c.rows.perHour, formatMyr(neo2.hourlyRateMyr), formatMyr(gt50.hourlyRateMyr)],
    [c.rows.battery1, formatMyr(neo2.batteryFeeMyr[1]), formatMyr(gt50.batteryFeeMyr[1])],
    [c.rows.battery2, formatMyr(neo2.batteryFeeMyr[2]), formatMyr(gt50.batteryFeeMyr[2])],
    [c.rows.swap, swapText(neo2), swapText(gt50)],
    [c.rows.late, formatMyr(neo2.hourlyRateMyr), formatMyr(gt50.hourlyRateMyr)],
    [c.rows.deposit, formatMyr(depositMyrFor("NEO2")), formatMyr(depositMyrFor("GT50"))],
    [c.rows.kit, c.kitNeo2, c.kitGt50],
    [c.rows.handover, c.handoverNeo2, c.handoverGt50],
  ];

  return (
    <div className="min-h-screen bg-black text-zinc-50">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
        <Brand logoUrl={logoUrl} size={28} onDark />
        <div className="flex items-center gap-5 text-sm text-zinc-400">
          <Link href="/rent" className="hidden hover:text-white sm:inline">
            {t.nav.drones}
          </Link>
          <a href="#compare" className="hidden hover:text-white sm:inline">
            {t.nav.compare}
          </a>
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
              <a
                href="#compare"
                className="inline-flex h-12 items-center rounded-full bg-white px-7 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                {t.ctaChoose}
              </a>
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

        <section id="compare" className="scroll-mt-6 border-y border-zinc-800 bg-zinc-950">
          <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{c.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">{c.sub}</p>
            <div className="mt-8 overflow-x-auto rounded-2xl border border-zinc-800 bg-black">
              <table className="w-full min-w-[22rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th scope="col" className="px-4 py-4 text-xs font-medium uppercase tracking-wide text-zinc-500 md:px-6">
                      {c.feature}
                    </th>
                    <th scope="col" className="whitespace-nowrap px-4 py-4 text-base font-semibold text-white md:px-6 md:text-lg">
                      {c.neo2}
                    </th>
                    <th scope="col" className="whitespace-nowrap px-4 py-4 text-base font-semibold text-white md:px-6 md:text-lg">
                      {c.gt50}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map(([label, a, b]) => (
                    <tr key={label} className="border-b border-zinc-900 last:border-b-0">
                      <th scope="row" className="px-4 py-3.5 text-left font-normal text-zinc-400 md:px-6">
                        {label}
                      </th>
                      <td className="px-4 py-3.5 font-medium text-zinc-100 md:px-6">{a}</td>
                      <td className="px-4 py-3.5 font-medium text-zinc-100 md:px-6">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mt-12 text-lg font-semibold tracking-tight text-white sm:text-xl">{c.specsTitle}</h3>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800 bg-black">
              <table className="w-full min-w-[22rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th scope="col" className="px-4 py-4 text-xs font-medium uppercase tracking-wide text-zinc-500 md:px-6">
                      {c.feature}
                    </th>
                    <th scope="col" className="whitespace-nowrap px-4 py-4 text-base font-semibold text-white md:px-6 md:text-lg">
                      {c.neo2}
                    </th>
                    <th scope="col" className="whitespace-nowrap px-4 py-4 text-base font-semibold text-white md:px-6 md:text-lg">
                      {c.gt50}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {c.specs.map((row) => (
                    <tr key={row.label} className="border-b border-zinc-900">
                      <th scope="row" className="px-4 py-3.5 text-left font-normal text-zinc-400 md:px-6">
                        {row.label}
                      </th>
                      <td className="px-4 py-3.5 font-medium text-zinc-100 md:px-6">{row.neo2}</td>
                      <td className="px-4 py-3.5 font-medium text-zinc-100 md:px-6">{row.gt50}</td>
                    </tr>
                  ))}
                  {c.features.map((row) => (
                    <tr key={row.label} className="border-b border-zinc-900 last:border-b-0">
                      <th scope="row" className="px-4 py-3.5 text-left font-normal text-zinc-400 md:px-6">
                        {row.label}
                      </th>
                      <td className="px-4 py-3.5 md:px-6">
                        <Mark on={row.neo2} yes={c.yes} no={c.no} />
                      </td>
                      <td className="px-4 py-3.5 md:px-6">
                        <Mark on={row.gt50} yes={c.yes} no={c.no} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 max-w-2xl text-xs leading-relaxed text-zinc-500">{c.specsNote}</p>

            <Link
              href="/rent"
              className="mt-8 inline-flex h-12 items-center rounded-full bg-white px-7 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              {t.ctaPrimary}
            </Link>
          </div>
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
              <p className="text-sm leading-relaxed text-zinc-400">{t.kitNote}</p>
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

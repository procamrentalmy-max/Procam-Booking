import Link from "next/link";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLandingImageUrls, getLogoUrl } from "@/lib/branding";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Brand } from "@/components/Brand";
import { Fragment } from "react";
import { CONTROLLER_PROFILES, DRONE_MODEL_PROFILES, depositMyrFor, formatMyr, hourlyRateFor } from "@/lib/droneRental/pricingRules";

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

type TableGroup = { title: string; rows: string[][] };

/** A comparison table: one column per choice, rows grouped under a small heading. Each row is the label followed by one cell per column. */
function CompareTable({ heads, groups, label }: { heads: string[]; groups: TableGroup[]; label: string }) {
  return (
    <div className="mt-8 overflow-x-auto rounded-2xl border border-zinc-800 bg-black">
      <table className="w-full min-w-[26rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            <th scope="col" className="px-4 py-4 md:px-6">
              <span className="sr-only">{label}</span>
            </th>
            {heads.map((h) => (
              <th key={h} scope="col" className="px-4 py-4 align-bottom text-base font-semibold text-white md:px-6 md:text-lg">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.title}>
              {g.title && (
                <tr className="border-b border-zinc-800 bg-zinc-950">
                  <th colSpan={heads.length + 1} className="px-4 pb-2 pt-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 md:px-6">
                    {g.title}
                  </th>
                </tr>
              )}
              {g.rows.map(([rowLabel, ...cells]) => (
                <tr key={rowLabel} className="border-b border-zinc-900 last:border-b-0">
                  <th scope="row" className="px-4 py-3.5 text-left font-normal text-zinc-400 md:px-6">
                    {rowLabel}
                  </th>
                  {cells.map((cell, i) => (
                    <td key={i} className="px-4 py-3.5 font-medium text-zinc-100 md:px-6">
                      {cell === "✓" ? <span className="text-emerald-400" aria-label="Yes">✓</span> : cell === "✗" ? <span className="text-zinc-500" aria-label="No">✗</span> : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Home() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.home;
  const [logoUrl, pictures] = await Promise.all([getLogoUrl(), getLandingImageUrls()]);

  // Every price in the tables comes from the same pricing rules the booking flow charges with, so this page can't drift from them.
  const c = t.compare;
  const fly = t.fly;
  const neo = DRONE_MODEL_PROFILES.NEO;
  const neo2 = DRONE_MODEL_PROFILES.NEO2;
  const both = (pick: (p: typeof neo) => number) => [formatMyr(pick(neo)), formatMyr(pick(neo2))];
  const droneGroups: TableGroup[] = [
    {
      title: c.priceGroup,
      rows: [
        [c.priceRows.perHour, formatMyr(hourlyRateFor("NEO", "NONE")), formatMyr(hourlyRateFor("NEO2", "NONE"))],
        [c.priceRows.battery1, ...both((p) => p.batteryFeeMyr[1])],
        [c.priceRows.battery2, ...both((p) => p.batteryFeeMyr[2])],
        [c.priceRows.swap1, ...both((p) => p.batteryFeeMyr[1])],
        [c.priceRows.swap2, ...both((p) => p.batteryFeeMyr[2])],
        [c.priceRows.late, formatMyr(hourlyRateFor("NEO", "NONE")), formatMyr(hourlyRateFor("NEO2", "NONE"))],
        [c.priceRows.deposit, formatMyr(depositMyrFor("NEO", "NONE")), formatMyr(depositMyrFor("NEO2", "NONE"))],
      ],
    },
    { title: c.specsGroup, rows: c.specs.map((r) => [r.label, r.neo, r.neo2]) },
  ];

  const rc = CONTROLLER_PROFILES.RC_N3;
  const gog = CONTROLLER_PROFILES.GOGGLES_N3;
  const flyGroups: TableGroup[] = [
    {
      title: "",
      rows: [
        [fly.extraHour, "—", `+${formatMyr(rc.hourlyMyr)}`, `+${formatMyr(gog.hourlyMyr)}`],
        [fly.extraDeposit, "—", `+${formatMyr(rc.depositMyr)}`, `+${formatMyr(gog.depositMyr)}`],
        [fly.needsPhone, "✓", "✓", "✗"],
        ...fly.rows.map((r) => [r.label, r.phone, r.rc, r.goggles]),
      ],
    },
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
          {pictures.hero ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local optimizable asset
            <img src={pictures.hero} alt="" className="w-full rounded-3xl border border-zinc-800 object-cover" />
          ) : (
            <div className="flex justify-center rounded-3xl border border-zinc-800 bg-zinc-950 p-6 md:p-8">
              <DroneIllustration />
            </div>
          )}
        </section>

        <section id="compare" className="scroll-mt-6 border-y border-zinc-800 bg-zinc-950">
          <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{c.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">{c.sub}</p>
            <CompareTable heads={[c.neo, c.neo2]} groups={droneGroups} label={c.title} />
            <p className="mt-3 text-xs text-zinc-500">{c.source}</p>

            <h2 id="fly" className="mt-16 scroll-mt-6 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {fly.title}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">{fly.sub}</p>
            <CompareTable heads={[fly.phone, fly.rc, fly.goggles]} groups={flyGroups} label={fly.option} />

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
          <div className="flex flex-col gap-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-8 md:p-10">
            <ul className="max-w-xl list-disc space-y-3 pl-5 text-base leading-relaxed text-zinc-300 marker:text-zinc-500">
              {t.kitPoints.map((point) => (
                <li key={point}>
                  {point.split("**").map((part, i) =>
                    i % 2 === 1 ? (
                      <strong key={i} className="font-semibold text-white underline underline-offset-4">
                        {part}
                      </strong>
                    ) : (
                      part
                    )
                  )}
                </li>
              ))}
            </ul>
            <Link
              href="/rent"
              className="inline-flex h-12 w-fit items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              {t.ctaPrimary}
            </Link>
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

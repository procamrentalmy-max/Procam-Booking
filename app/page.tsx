import Link from "next/link";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getComboPictureUrls, getLandingImageUrls, getLogoUrl } from "@/lib/branding";
import { PackagePicker } from "@/components/droneRental/PackagePicker";
import { PackageProvider } from "@/components/droneRental/PackageContext";
import { CompareTable } from "@/components/droneRental/CompareTable";
import { buildCompareTables } from "@/lib/droneRental/compareTables";
import { hasTutorial } from "@/lib/tutorials";
import { FunnelBeacon } from "@/components/FunnelBeacon";
import { TablePreference } from "@/components/droneRental/TablePreference";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Brand } from "@/components/Brand";

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
  const [logoUrl, pictures, comboPictures, showTutorial] = await Promise.all([getLogoUrl(), getLandingImageUrls(), getComboPictureUrls(), hasTutorial()]);

  // Every price in the tables comes from the same pricing rules the booking flow charges with (lib/droneRental/compareTables.ts).
  const tables = buildCompareTables(t);
  const c = t.compare;
  const fly = t.fly;

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
          {showTutorial && (
            <Link href="/tutorial" className="hidden hover:text-white sm:inline">
              {t.tutorial.nav}
            </Link>
          )}
          <LanguageToggle locale={locale} onDark />
        </div>
      </header>

      <PackageProvider>
      <FunnelBeacon step="HOME" />
      <main>
        <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 pb-16 pt-10 md:grid-cols-[1.2fr_1fr] md:pb-24 md:pt-16">
          <div>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl md:text-6xl">
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
                href="#price"
                className="inline-flex h-12 items-center rounded-full border border-zinc-700 px-7 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white"
              >
                {t.ctaSecondary}
              </a>
            </div>
          </div>
          {pictures.hero ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local optimizable asset
            <img src={pictures.hero} alt="" className="w-full rounded-3xl border border-zinc-800 object-cover object-bottom" />
          ) : (
            <div className="flex justify-center rounded-3xl border border-zinc-800 bg-zinc-950 p-6 md:p-8">
              <DroneIllustration />
            </div>
          )}
        </section>

        <section id="how" className="mx-auto max-w-5xl scroll-mt-6 px-6 pb-12 md:pb-16">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t.stepsTitle}</h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-400">
            {showTutorial && (
              <Link href="/tutorial" className="underline underline-offset-4 hover:text-zinc-200">
                {t.tutorial.watch}
              </Link>
            )}
            <Link href="/legal/faq" className="underline underline-offset-4 hover:text-zinc-200">
              {t.faqLine}
            </Link>
          </p>
        </section>

        <section id="price" className="scroll-mt-6 border-y border-slate-700 bg-slate-800">
          <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t.price.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-300">{t.price.sub}</p>
            <PackagePicker locale={locale} pictures={comboPictures} text={{ hint: t.price.hint, cta: t.price.cta, next: t.price.next }} tables={tables} />
          </div>
        </section>

        <section id="compare" className="scroll-mt-6 border-y border-zinc-800 bg-zinc-950">
          <div className="mx-auto max-w-5xl px-6 py-12 md:py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{c.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">{c.sub}</p>
            <CompareTable heads={tables.drone.heads} groups={tables.drone.groups} label={tables.drone.label} />
            <p className="mt-3 text-xs text-zinc-500">{c.source}</p>
            <TablePreference kind="drone" locale={locale} text={t.prefer} />

            <h2 id="fly" className="mt-16 scroll-mt-6 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {fly.title}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">{fly.sub}</p>
            <CompareTable heads={tables.fly.heads} groups={tables.fly.groups} label={tables.fly.label} />
            <TablePreference kind="fly" locale={locale} text={t.prefer} />

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/rent"
                className="inline-flex h-12 items-center rounded-full bg-white px-7 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                {t.ctaPrimary}
              </Link>
              <a
                href="#price"
                className="inline-flex h-12 items-center rounded-full border border-zinc-700 px-7 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white"
              >
                {t.ctaSecondary}
              </a>
            </div>
          </div>
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
            <div className="flex flex-wrap gap-3">
              <Link
                href="/rent"
                className="inline-flex h-12 w-fit items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                {t.ctaPrimary}
              </Link>
              <a
                href="#price"
                className="inline-flex h-12 w-fit items-center justify-center rounded-full border border-zinc-700 px-7 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white"
              >
                {t.ctaSecondary}
              </a>
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
      </PackageProvider>

      <footer className="border-t border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 text-xs text-zinc-600">
          <span>© ProCam Rental</span>
          <nav aria-label="Legal" className="flex flex-wrap justify-end gap-x-4 gap-y-1">
            <Link href="/legal/terms" className="hover:text-zinc-300">
              {t.terms}
            </Link>
            <Link href="/legal/refunds" className="hover:text-zinc-300">
              {t.refunds}
            </Link>
            <Link href="/legal/privacy" className="hover:text-zinc-300">
              {t.privacy}
            </Link>
            {showTutorial && (
              <Link href="/tutorial" className="hover:text-zinc-300">
                {t.tutorial.nav}
              </Link>
            )}
            <Link href="/legal/faq" className="hover:text-zinc-300">
              {t.faq}
            </Link>
            <Link href="/legal/contact" className="hover:text-zinc-300">
              {t.contact}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

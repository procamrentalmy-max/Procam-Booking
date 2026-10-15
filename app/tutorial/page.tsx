import Link from "next/link";
import { Brand } from "@/components/Brand";
import { LanguageToggle } from "@/components/LanguageToggle";
import { getLogoUrl } from "@/lib/branding";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/getLocale";
import { getTutorialSections } from "@/lib/tutorials";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = getDictionary(await getLocale()).home.tutorial;
  return { title: `${t.title} — ProCam Rental`, description: t.sub };
}

/**
 * The Tutorial page: the headers, photos and videos the admin set up (Admin > Tutorials). Every photo and video is shown whole, never
 * cropped: it fills the width of the phone, and one that is taller than the screen is scaled down to fit it, so the whole picture is in view.
 */
export default async function TutorialPage() {
  const [sections, logoUrl, locale] = await Promise.all([getTutorialSections(), getLogoUrl(), getLocale()]);
  const t = getDictionary(locale).home.tutorial;
  const shown = sections.filter((s) => s.media.length > 0);
  const frame = "block h-auto max-h-[85vh] w-full rounded-xl bg-zinc-100 object-contain dark:bg-zinc-900";

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <Brand logoUrl={logoUrl} size={24} />
        <LanguageToggle locale={locale} inline />
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{t.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t.sub}</p>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">{t.empty}</p>
      ) : (
        shown.map((section) => (
          <section key={section.id} className="space-y-4">
            <h2 className="text-lg font-semibold text-black dark:text-zinc-50">{section.title}</h2>
            <div className="space-y-5">
              {section.media.map((m) => (
                <figure key={m.id} className="space-y-2">
                  {m.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local optimizable asset
                    <img src={m.url} alt={m.caption ?? section.title} loading="lazy" decoding="async" className={frame} />
                  ) : (
                    <video src={m.url} controls playsInline preload="metadata" className={frame} />
                  )}
                  {m.caption && <figcaption className="text-sm text-zinc-600 dark:text-zinc-400">{m.caption}</figcaption>}
                </figure>
              ))}
            </div>
          </section>
        ))
      )}

      <p className="border-t border-zinc-200 pt-4 text-sm text-zinc-500 dark:border-zinc-800">
        <Link href="/" className="underline underline-offset-2">
          {t.back}
        </Link>
        {" · "}
        <Link href="/legal/faq" className="underline underline-offset-2">
          {t.faq}
        </Link>
      </p>
    </div>
  );
}

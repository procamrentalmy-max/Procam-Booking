import Link from "next/link";
import { Brand } from "@/components/Brand";
import { PendingLink } from "@/components/PendingLink";
import { LanguageToggle } from "@/components/LanguageToggle";
import { getLogoUrl } from "@/lib/branding";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/getLocale";
import { notFound } from "next/navigation";
import { audienceFromSlug, getTutorialSections } from "@/lib/tutorials";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ audience: string }> }) {
  const { audience } = await params;
  const t = getDictionary(await getLocale()).home.tutorial;
  const title = audienceFromSlug(audience) === "CONTROLLER" ? t.titleController : t.titlePhone;
  return { title: `${title} — ProCam Rental`, description: t.sub };
}

/**
 * The Tutorial page: the headers, photos and videos the admin set up (Admin > Tutorials). Every photo and video is shown whole, never
 * cropped: it fills the width of the phone, and one that is taller than the screen is scaled down to fit it, so the whole picture is in view.
 */
export default async function TutorialPage({ params }: { params: Promise<{ audience: string }> }) {
  const { audience: slug } = await params;
  const audience = audienceFromSlug(slug);
  if (!audience) notFound();
  const [sections, logoUrl, locale] = await Promise.all([getTutorialSections(audience), getLogoUrl(), getLocale()]);
  const t = getDictionary(locale).home.tutorial;
  const shown = sections.filter((s) => s.media.length > 0);
  const frame = "block h-auto max-h-[85vh] w-full rounded-xl bg-zinc-100 object-contain dark:bg-zinc-900";

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <Brand logoUrl={logoUrl} size={24} />
        <LanguageToggle locale={locale} inline />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{audience === "CONTROLLER" ? t.titleController : t.titlePhone}</h1>
          <PendingLink
            href={audience === "CONTROLLER" ? "/tutorial/phone" : "/tutorial/controller"}
            className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-black px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            {audience === "CONTROLLER" ? t.usePhone : t.useController}
          </PendingLink>
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
        <Link href="/tutorial" className="underline underline-offset-2">
          {t.other}
        </Link>
        {" · "}
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

import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLogoUrl } from "@/lib/branding";
import { Brand } from "@/components/Brand";

export const metadata = {
  title: "Terms & Conditions — ProCam Rental",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold text-black dark:text-zinc-50">{title}</h2>
      <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </section>
  );
}

/** Splits a paragraph containing the literal token "{privacyLink}" into text/link/text, so the Privacy cross-reference in section 4 stays a real in-page anchor in every language. */
function renderParagraph(paragraph: string, privacyLinkText: string) {
  const token = "{privacyLink}";
  const index = paragraph.indexOf(token);
  if (index === -1) return paragraph;
  return (
    <>
      {paragraph.slice(0, index)}
      <a href="#privacy" className="underline underline-offset-2">
        {privacyLinkText}
      </a>
      {paragraph.slice(index + token.length)}
    </>
  );
}

/**
 * One general agreement covering the whole service — booking, payment,
 * deposits, damage, verification, privacy, liability. This is separate from
 * the short per-product liability clause shown at booking confirmation
 * (product_terms_versions / booking_acknowledgements), which stays focused
 * and version-tracked per product; this page is the fuller reference it
 * links out to, not a replacement for it.
 */
export default async function TermsPage() {
  const dict = getDictionary(await getLocale());
  const t = dict.terms;
  const logoUrl = await getLogoUrl();

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-10">
      <Brand logoUrl={logoUrl} size={24} />

      <div>
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{t.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t.lastUpdated}</p>
      </div>

      {t.sections.map((section, i) => (
        <Section key={i} title={section.title}>
          {section.paragraphs.map((paragraph, j) => (
            <p key={j} id={i === 9 && j === 0 ? "privacy" : undefined}>
              {i === 3 ? renderParagraph(paragraph, t.privacyLinkText) : paragraph}
            </p>
          ))}
        </Section>
      ))}
    </div>
  );
}

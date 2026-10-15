import { BUSINESS, legalUpdatedLabel, registeredNameDiffers } from "@/lib/legal";
import { getLocale } from "@/lib/i18n/getLocale";
import { legalText } from "@/lib/i18n/legal";
import { renderLegalText } from "../LegalDoc";
import { LegalSection, LegalTitle } from "../LegalSection";

export async function generateMetadata() {
  const t = legalText(await getLocale());
  return { title: `${t.contact.title} — ProCam Rental`, description: t.contact.description };
}

export default async function ContactPage() {
  const locale = await getLocale();
  const t = legalText(locale);
  const c = t.contact;
  return (
    <>
      <LegalTitle title={c.title} updated={t.updated(legalUpdatedLabel(locale))} />

      <LegalSection title={c.helpTitle}>
        <p>{c.help}</p>
        {BUSINESS.supportEmail && (
          <p>
            {c.emailLabel}: <a href={`mailto:${BUSINESS.supportEmail}`} className="underline underline-offset-2">{BUSINESS.supportEmail}</a>
          </p>
        )}
        {BUSINESS.supportPhone && (
          <p>
            {c.phoneLabel}: {BUSINESS.supportPhone}
          </p>
        )}
        <p>{c.staffNote}</p>
        <p>{renderLegalText(c.faqNote, locale)}</p>
      </LegalSection>

      <LegalSection title={c.shopsTitle}>
        <p>{c.shops}</p>
      </LegalSection>

      <LegalSection title={c.businessTitle}>
        <p>
          {registeredNameDiffers() && BUSINESS.registeredName ? c.businessRegistered(BUSINESS.registeredName, BUSINESS.brand) : c.business(BUSINESS.brand)}
          {BUSINESS.ssmNumber && <> {c.ssm(BUSINESS.ssmNumber)}</>}
        </p>
      </LegalSection>
    </>
  );
}

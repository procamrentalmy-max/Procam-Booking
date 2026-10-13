import { getLocale } from "@/lib/i18n/getLocale";
import { legalText } from "@/lib/i18n/legal";
import { LegalDoc } from "../LegalDoc";

export async function generateMetadata() {
  const t = legalText(await getLocale()).terms;
  return { title: `${t.title} — ProCam Rental`, description: t.description };
}

export default async function TermsPage() {
  const locale = await getLocale();
  return <LegalDoc page={legalText(locale).terms} locale={locale} />;
}

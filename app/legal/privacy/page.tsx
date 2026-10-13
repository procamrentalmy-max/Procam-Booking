import { getLocale } from "@/lib/i18n/getLocale";
import { legalText } from "@/lib/i18n/legal";
import { LegalDoc } from "../LegalDoc";

export async function generateMetadata() {
  const t = legalText(await getLocale()).privacy;
  return { title: `${t.title} — ProCam Rental`, description: t.description };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  return <LegalDoc page={legalText(locale).privacy} locale={locale} />;
}

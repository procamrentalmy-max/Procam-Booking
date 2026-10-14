import { getLocale } from "@/lib/i18n/getLocale";
import { legalText } from "@/lib/i18n/legal";
import { FaqDoc } from "../LegalDoc";

export async function generateMetadata() {
  const t = legalText(await getLocale()).faq;
  return { title: `${t.title} — ProCam Rental`, description: t.description };
}

export default async function FaqPage() {
  return <FaqDoc locale={await getLocale()} />;
}

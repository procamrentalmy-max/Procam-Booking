import { getLocale } from "@/lib/i18n/getLocale";
import { LanguageToggle } from "@/components/LanguageToggle";

export default async function RentalLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <>
      <LanguageToggle locale={locale} />
      {children}
    </>
  );
}

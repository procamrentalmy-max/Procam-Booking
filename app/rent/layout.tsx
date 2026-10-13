import { getLocale } from "@/lib/i18n/getLocale";
import { LanguageToggle } from "@/components/LanguageToggle";

/** The drone rental pages (shop picker, booking, payment, walk-in order) follow the visitor's language, English / Bahasa Melayu / 中文. */
export default async function RentLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <>
      <LanguageToggle locale={locale} />
      {children}
    </>
  );
}

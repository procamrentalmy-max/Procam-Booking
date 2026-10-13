import Link from "next/link";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";

/** "By booking you agree to the Terms, the Refund policy and the Privacy policy." in the visitor's language, with the three names as links. */
export function AgreeLine({ locale }: { locale: Locale }) {
  const t = droneText(locale).common;
  const cls = "underline underline-offset-2";
  return (
    <>
      {t.agree.split(/(\{terms\}|\{refunds\}|\{privacy\})/g).map((part, i) => {
        if (part === "{terms}") return <Link key={i} href="/legal/terms" target="_blank" className={cls}>{t.agreeTerms}</Link>;
        if (part === "{refunds}") return <Link key={i} href="/legal/refunds" target="_blank" className={cls}>{t.agreeRefunds}</Link>;
        if (part === "{privacy}") return <Link key={i} href="/legal/privacy" target="_blank" className={cls}>{t.agreePrivacy}</Link>;
        return part;
      })}
    </>
  );
}

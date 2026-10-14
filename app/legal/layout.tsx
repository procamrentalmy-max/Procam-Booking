import Link from "next/link";
import { getLogoUrl } from "@/lib/branding";
import { Brand } from "@/components/Brand";
import { LanguageToggle } from "@/components/LanguageToggle";
import { getLocale } from "@/lib/i18n/getLocale";
import { legalText } from "@/lib/i18n/legal";

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const [logoUrl, locale] = await Promise.all([getLogoUrl(), getLocale()]);
  const t = legalText(locale);
  const pages = [
    { href: "/legal/terms", label: t.nav.terms },
    { href: "/legal/refunds", label: t.nav.refunds },
    { href: "/legal/privacy", label: t.nav.privacy },
    { href: "/legal/faq", label: t.nav.faq },
    { href: "/legal/contact", label: t.nav.contact },
  ];
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <Brand logoUrl={logoUrl} size={24} />
        <LanguageToggle locale={locale} inline />
      </div>
      <nav aria-label={t.navLabel} className="flex flex-wrap gap-x-5 gap-y-2 border-b border-zinc-200 pb-3 text-sm dark:border-zinc-800">
        {pages.map((p) => (
          <Link key={p.href} href={p.href} className="text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400">
            {p.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}

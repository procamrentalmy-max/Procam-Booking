import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLogoUrl } from "@/lib/branding";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Brand } from "@/components/Brand";

export default async function Home() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const logoUrl = await getLogoUrl();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <LanguageToggle locale={locale} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Brand logoUrl={logoUrl} size={48} />
        <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">{dict.home.subtitle}</p>
        <p className="max-w-sm rounded-full bg-black/5 px-4 py-2 text-xs font-medium text-black dark:bg-white/10 dark:text-zinc-50">
          {dict.home.usp}
        </p>
      </div>
    </div>
  );
}

import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LanguageToggle } from "@/components/LanguageToggle";

export default async function Home() {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <LanguageToggle locale={locale} />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">{dict.home.title}</h1>
        <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">{dict.home.subtitle}</p>
      </div>
    </div>
  );
}

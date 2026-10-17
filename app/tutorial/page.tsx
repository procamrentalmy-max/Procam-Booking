import { PendingLink } from "@/components/PendingLink";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/getLocale";

export async function generateMetadata() {
  const t = getDictionary(await getLocale()).home.tutorial;
  return { title: `${t.title} — ProCam Rental`, description: t.sub };
}

/** The Tutorial page: one question in the middle and two big buttons, one for each tutorial (flying with the phone, flying with the controller). */
export default async function TutorialChoicePage() {
  const t = getDictionary(await getLocale()).home.tutorial;
  const button =
    "flex min-h-32 w-full items-center justify-center rounded-3xl bg-black px-6 text-2xl font-semibold text-white shadow-sm transition hover:-translate-y-px hover:bg-zinc-800 active:translate-y-0 dark:bg-white dark:text-black dark:hover:bg-zinc-200 sm:min-h-40";
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-10 px-6 py-10 text-center">
      <h1 className="text-3xl font-semibold text-black dark:text-zinc-50 sm:text-4xl">{t.choose}</h1>
      <div className="grid w-full gap-4 sm:grid-cols-2">
        <PendingLink href="/tutorial/phone" className={button}>
          {t.usePhone}
        </PendingLink>
        <PendingLink href="/tutorial/controller" className={button}>
          {t.useController}
        </PendingLink>
      </div>
    </main>
  );
}

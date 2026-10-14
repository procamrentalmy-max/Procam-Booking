import Link from "next/link";
import { droneText } from "@/lib/i18n/drone";
import type { Locale } from "@/lib/i18n/locale";

/** "Questions? Read the FAQ" in the visitor's language. Opens in a new tab so a booking in progress is not lost. */
export function FaqLink({ locale, className = "text-center text-xs text-zinc-400" }: { locale: Locale; className?: string }) {
  return (
    <p className={className}>
      <Link href="/legal/faq" target="_blank" className="underline underline-offset-2">
        {droneText(locale).common.faq}
      </Link>
    </p>
  );
}

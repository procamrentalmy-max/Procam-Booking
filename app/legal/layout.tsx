import Link from "next/link";
import { getLogoUrl } from "@/lib/branding";
import { Brand } from "@/components/Brand";

const PAGES = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/refunds", label: "Refunds" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/contact", label: "Contact" },
];

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const logoUrl = await getLogoUrl();
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-10">
      <Brand logoUrl={logoUrl} size={24} />
      <nav aria-label="Legal pages" className="flex flex-wrap gap-x-5 gap-y-2 border-b border-zinc-200 pb-3 text-sm dark:border-zinc-800">
        {PAGES.map((p) => (
          <Link key={p.href} href={p.href} className="text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400">
            {p.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}

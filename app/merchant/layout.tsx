import { redirect } from "next/navigation";
import { getAuthContext, hasMerchantAccess } from "@/lib/auth/session";
import { getLogoUrl } from "@/lib/branding";
import { AreaHeader } from "@/components/AreaHeader";

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login?next=/merchant");
  if (!hasMerchantAccess(ctx)) redirect("/login");
  const logoUrl = await getLogoUrl();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AreaHeader title="Drone Rental — Merchant" name={ctx.name} homeHref="/merchant" logoUrl={logoUrl} />
      <main className="mx-auto max-w-md p-4">{children}</main>
    </div>
  );
}

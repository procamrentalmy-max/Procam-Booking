import { redirect } from "next/navigation";
import { getAuthContext, isAdmin, ROLE_HOME } from "@/lib/auth/session";
import { getLogoUrl } from "@/lib/branding";
import { AreaHeader } from "@/components/AreaHeader";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login?next=/admin");
  if (!isAdmin(ctx)) redirect(ROLE_HOME[ctx.kind]);
  const logoUrl = await getLogoUrl();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AreaHeader title="Admin" name={ctx.name} homeHref="/admin" logoUrl={logoUrl} />
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}

import { redirect } from "next/navigation";
import { getAuthContext, hasStaffAccess } from "@/lib/auth/session";
import { getLogoUrl } from "@/lib/branding";
import { AreaHeader } from "@/components/AreaHeader";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login?next=/staff");
  if (!hasStaffAccess(ctx)) redirect("/login");
  const logoUrl = await getLogoUrl();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AreaHeader title="ProCam Staff" name={ctx.name} homeHref="/staff" logoUrl={logoUrl} />
      <main className="mx-auto max-w-3xl p-4">{children}</main>
    </div>
  );
}

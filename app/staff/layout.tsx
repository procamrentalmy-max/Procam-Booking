import { redirect } from "next/navigation";
import { getAuthContext, hasStaffAccess } from "@/lib/auth/session";
import { AreaHeader } from "@/components/AreaHeader";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login?next=/staff");
  if (!hasStaffAccess(ctx)) redirect("/login");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AreaHeader title="ProCam Staff" name={ctx.name} />
      <main className="mx-auto max-w-3xl p-4">{children}</main>
    </div>
  );
}

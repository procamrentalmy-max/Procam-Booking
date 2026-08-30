import { redirect } from "next/navigation";
import { getAuthContext, isReception, ROLE_HOME } from "@/lib/auth/session";
import { AreaHeader } from "@/components/AreaHeader";

export default async function ReceptionLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login?next=/reception");
  if (!isReception(ctx)) redirect(ROLE_HOME[ctx.kind]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <AreaHeader title="Reception" name={ctx.name} />
      <main className="mx-auto max-w-md p-4">{children}</main>
    </div>
  );
}

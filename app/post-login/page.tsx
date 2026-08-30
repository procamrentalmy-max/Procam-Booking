import { redirect } from "next/navigation";
import { getAuthContext, ROLE_HOME } from "@/lib/auth/session";

export default async function PostLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const ctx = await getAuthContext();

  if (!ctx) {
    redirect("/login?error=not-provisioned");
  }

  const { next } = await searchParams;
  const home = ROLE_HOME[ctx.kind];

  if (next && next.startsWith(home)) {
    redirect(next);
  }

  redirect(home);
}

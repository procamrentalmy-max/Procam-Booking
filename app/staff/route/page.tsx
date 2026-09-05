import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { getNextStopForStaff } from "@/lib/worker/route";
import { RouteStopView } from "./RouteStopView";

export default async function WorkerRoutePage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login?next=/staff/route");

  const result = await getNextStopForStaff(ctx.staffId);

  if (result.error !== null) {
    return (
      <Message>
        {result.error === "NO_WORKER_ROW"
          ? "You're not set up as a worker yet — ask an admin to create your worker profile."
          : "Your worker profile is currently inactive."}
      </Message>
    );
  }

  return <RouteStopView nextStop={result.nextStop} unmetDropoffs={result.unmetDropoffs} />;
}

function Message({ children }: { children: React.ReactNode }) {
  return <p className="pt-8 text-center text-sm text-zinc-500">{children}</p>;
}

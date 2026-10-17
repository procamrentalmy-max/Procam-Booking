import { PendingLink } from "@/components/PendingLink";
import { Brand } from "@/components/Brand";
import { getLogoUrl } from "@/lib/branding";

/** Where the hotel-locker pages send people while that service is switched off (lib/features.ts). */
export default async function PausedPage() {
  const logoUrl = await getLogoUrl();
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <Brand logoUrl={logoUrl} size={26} />
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">This service is paused for now</h1>
      <p className="text-sm text-zinc-500">The hotel locker camera rental is not taking bookings at the moment. You can rent a drone instead.</p>
      <PendingLink href="/" className="inline-flex min-h-11 items-center rounded-full bg-slate-700 px-6 text-sm font-semibold text-white">
        See the drones
      </PendingLink>
    </div>
  );
}

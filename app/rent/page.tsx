import { listActiveShopsWithAvailability } from "@/lib/droneRental/shops";
import { ShopMapPicker } from "@/components/droneRental/ShopMapPicker";
import { getLogoUrl } from "@/lib/branding";
import { Brand } from "@/components/Brand";

// Shop list + "first available now/at HH:MM" both depend on live DB state
// (which shops are active, which drones are free right now) — this must
// never be statically prerendered, or it freezes at whatever the database
// looked like at build time (bit us once already: 0 shops existed then).
export const dynamic = "force-dynamic";

export default async function RentLandingPage() {
  // Server-rendered without a customer location yet (a browser API, not
  // available server-side) — the client re-fetches sorted-by-distance the
  // moment geolocation resolves. Rendering something immediately (even
  // unsorted) beats a blank page while that permission prompt is pending.
  const [initialShops, logoUrl] = await Promise.all([listActiveShopsWithAvailability(null), getLogoUrl()]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-6 py-6">
      <Brand logoUrl={logoUrl} size={22} />
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Rent a drone</h1>
        <p className="mt-1 text-sm text-zinc-500">Pick a shop to collect from. You&apos;ll choose a time next.</p>
      </div>
      <ShopMapPicker initialShops={initialShops} />
    </div>
  );
}

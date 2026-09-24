import { listActiveShopsWithAvailability } from "@/lib/droneRental/shops";
import { ShopMapPicker } from "@/components/droneRental/ShopMapPicker";

export default async function RentLandingPage() {
  // Server-rendered without a customer location yet (a browser API, not
  // available server-side) — the client re-fetches sorted-by-distance the
  // moment geolocation resolves. Rendering something immediately (even
  // unsorted) beats a blank page while that permission prompt is pending.
  const initialShops = await listActiveShopsWithAvailability(null);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-6 py-8">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Choose a pickup spot</h1>
        <p className="mt-1 text-sm text-zinc-500">Tap a shop on the map to see availability and book.</p>
      </div>
      <ShopMapPicker initialShops={initialShops} />
    </div>
  );
}

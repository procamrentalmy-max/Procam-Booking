import { notFound } from "next/navigation";
import { getComboPictureUrls, getLogoUrl } from "@/lib/branding";
import { Brand } from "@/components/Brand";
import { findShopByWalkInCode, walkInOptionsByModel } from "@/lib/droneRental/walkInRequests";
import { WalkInOrderForm } from "./WalkInOrderForm";

// Which lengths are offered depends on which drones are free right now — never cache this.
export const dynamic = "force-dynamic";

/** What a customer sees after scanning the shop's standing walk-in QR: pick a length and batteries, enter details, send the order. */
export default async function WalkInOrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const shop = await findShopByWalkInCode(code);
  if (!shop) notFound();

  const [options, logoUrl, pictures] = await Promise.all([walkInOptionsByModel(shop.id), getLogoUrl(), getComboPictureUrls()]);
  const offered = Object.keys(options).length > 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-6 py-6">
      <Brand logoUrl={logoUrl} size={22} />
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-400">{shop.name}</p>
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Rent a drone now</h1>
        <p className="mt-1 text-sm text-zinc-500">A drone, charged and ready at this shop. Fly it from your phone, or add a controller.</p>
      </div>

      {!offered ? (
        <div className="rounded-2xl border border-zinc-200 p-5 text-center dark:border-zinc-800">
          <p className="text-lg font-semibold text-black dark:text-zinc-50">No drone is free right now</p>
          <p className="mt-1 text-sm text-zinc-500">Please ask the staff when one will be back.</p>
        </div>
      ) : (
        <WalkInOrderForm code={code} options={options} pictures={pictures} />
      )}
    </div>
  );
}

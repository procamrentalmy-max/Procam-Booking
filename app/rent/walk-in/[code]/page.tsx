import { notFound } from "next/navigation";
import { getComboPictureUrls, getLogoUrl } from "@/lib/branding";
import { Brand } from "@/components/Brand";
import { findShopByWalkInCode, walkInOptionsByModel, windyModelsNow } from "@/lib/droneRental/walkInRequests";
import { formatWind } from "@/lib/droneRental/windRules";
import { DRONE_MODEL_PROFILES } from "@/lib/droneRental/pricingRules";
import { WalkInOrderForm } from "./WalkInOrderForm";

// Which lengths are offered depends on which drones are free right now — never cache this.
export const dynamic = "force-dynamic";

/** What a customer sees after scanning the shop's standing walk-in QR: pick a length and batteries, enter details, send the order. */
export default async function WalkInOrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const shop = await findShopByWalkInCode(code);
  if (!shop) notFound();

  const [options, logoUrl, pictures, windy] = await Promise.all([walkInOptionsByModel(shop.id), getLogoUrl(), getComboPictureUrls(), windyModelsNow(shop.id)]);
  const offered = Object.keys(options).length > 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-6 py-6">
      <Brand logoUrl={logoUrl} size={22} />
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-400">{shop.name}</p>
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Rent a drone now</h1>
        <p className="mt-1 text-sm text-zinc-500">A drone, charged and ready at this shop. Fly it from your phone, or add a controller.</p>
      </div>

      {windy.length > 0 && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Too windy for the {windy.map((w) => `${DRONE_MODEL_PROFILES[w.model].shortName} (${formatWind(w.windMps)}, limit ${formatWind(w.limitMps)})`).join(" and the ")} right now.
        </p>
      )}

      {!offered ? (
        <div className="rounded-2xl border border-zinc-200 p-5 text-center dark:border-zinc-800">
          <p className="text-lg font-semibold text-black dark:text-zinc-50">{windy.length > 0 ? "Too windy to fly right now" : "No drone is free right now"}</p>
          <p className="mt-1 text-sm text-zinc-500">{windy.length > 0 ? "Please ask the staff, or try again later." : "Please ask the staff when one will be back."}</p>
        </div>
      ) : (
        <WalkInOrderForm code={code} options={options} pictures={pictures} />
      )}
    </div>
  );
}

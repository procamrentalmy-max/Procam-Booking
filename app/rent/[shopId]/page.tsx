import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { DroneBookingWizard } from "@/components/droneRental/DroneBookingWizard";
import { getLogoUrl } from "@/lib/branding";
import { Brand } from "@/components/Brand";
import { DRONE_MODELS, isDroneModel, type DroneModel } from "@/lib/droneRental/pricingRules";

export default async function ShopBookingPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const supabase = createServiceRoleClient();

  const { data: shop } = await supabase
    .from("dr_shops")
    .select("id,name,address,active")
    .eq("id", shopId)
    .maybeSingle();
  if (!shop || !shop.active) notFound();
  const logoUrl = await getLogoUrl();

  // Offer only the models this shop actually has a working drone of.
  const { data: shopDrones } = await supabase.from("dr_drones").select("model_key,status").eq("shop_id", shop.id);
  const offered = new Set((shopDrones ?? []).filter((d) => d.status !== "RETIRED" && d.status !== "LOST").map((d) => d.model_key));
  const models: DroneModel[] = DRONE_MODELS.filter((m) => offered.has(m) && isDroneModel(m));

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-6 py-6">
      <Brand logoUrl={logoUrl} size={22} />
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-400">Collect from</p>
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{shop.name}</h1>
        <p className="mt-0.5 text-sm text-zinc-500">{shop.address}</p>
      </div>
      <DroneBookingWizard shopId={shop.id} models={models.length ? models : ["NEO2"]} />
    </div>
  );
}

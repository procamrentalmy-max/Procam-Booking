import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { DroneBookingWizard } from "@/components/droneRental/DroneBookingWizard";
import { getComboPictureUrls, getLogoUrl } from "@/lib/branding";
import { Brand } from "@/components/Brand";
import { ENABLED_DRONE_MODELS, isDroneModel, type ControllerKind, type DroneModel } from "@/lib/droneRental/pricingRules";

export default async function ShopBookingPage({ params, searchParams }: { params: Promise<{ shopId: string }>; searchParams: Promise<{ retry?: string }> }) {
  const { shopId } = await params;
  const { retry } = await searchParams;
  const supabase = createServiceRoleClient();

  const { data: shop } = await supabase
    .from("dr_shops")
    .select("id,name,address,active")
    .eq("id", shopId)
    .maybeSingle();
  if (!shop || !shop.active) notFound();
  const [logoUrl, pictures] = await Promise.all([getLogoUrl(), getComboPictureUrls()]);

  // Offer only the models this shop actually has a working drone of.
  const { data: shopDrones } = await supabase.from("dr_drones").select("model_key,status").eq("shop_id", shop.id);
  const offered = new Set((shopDrones ?? []).filter((d) => d.status !== "RETIRED" && d.status !== "LOST").map((d) => d.model_key));
  const models: DroneModel[] = ENABLED_DRONE_MODELS.filter((m) => isDroneModel(m));
  const availableModels: DroneModel[] = models.filter((m) => offered.has(m));

  // And only the controllers this shop actually has (a shop with none rents phone-only).
  const { data: shopControllers } = await supabase.from("dr_controllers").select("kind").eq("shop_id", shop.id);
  const controllers: ControllerKind[] = [...new Set((shopControllers ?? []).map((c) => c.kind))];

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-6 py-6">
      <Brand logoUrl={logoUrl} size={22} />
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-400">Collect from</p>
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{shop.name}</h1>
        <p className="mt-0.5 text-sm text-zinc-500">{shop.address}</p>
      </div>
      <DroneBookingWizard shopId={shop.id} models={models} availableModels={availableModels.length ? availableModels : ["NEO2"]} controllers={controllers} pictures={pictures} retry={retry === "1"} />
    </div>
  );
}

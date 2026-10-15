import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { DroneBookingWizard } from "@/components/droneRental/DroneBookingWizard";
import { getComboPictureUrls, getLogoUrl } from "@/lib/branding";
import { Brand } from "@/components/Brand";
import { getAuthContext, isAdmin } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/getLocale";
import { droneText } from "@/lib/i18n/drone";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildCompareTables } from "@/lib/droneRental/compareTables";
import { packageQuery, parsePackagePreset } from "@/lib/droneRental/packagePreset";
import { parseShopHours } from "@/lib/droneRental/hours";
import { ENABLED_DRONE_MODELS, isDroneModel, type ControllerKind, type DroneModel } from "@/lib/droneRental/pricingRules";

export default async function ShopBookingPage({ params, searchParams }: { params: Promise<{ shopId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { shopId } = await params;
  const query = await searchParams;
  const retry = Array.isArray(query.retry) ? query.retry[0] : query.retry;
  // A package picked on the landing page, carried through the shop list.
  const preset = parsePackagePreset(query);
  const supabase = createServiceRoleClient();

  const { data: shop } = await supabase
    .from("dr_shops")
    .select("id,name,address,active,hours")
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
  // A signed-in admin gets test-only skip buttons on the live site; nobody else does.
  const adminCanSkip = isAdmin(await getAuthContext());
  const locale = await getLocale();
  const t = droneText(locale);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 px-6 py-6">
      <Brand logoUrl={logoUrl} size={22} />
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-400">{t.pay.collectFrom}</p>
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{shop.name}</h1>
        <p className="mt-0.5 text-sm text-zinc-500">{shop.address}</p>
      </div>
      <DroneBookingWizard locale={locale} adminCanSkip={adminCanSkip} shopId={shop.id} models={models} availableModels={availableModels.length ? availableModels : ["NEO2"]} controllers={controllers} pictures={pictures} retry={retry === "1"} preset={preset} tables={buildCompareTables(getDictionary(locale).home)} hours={parseShopHours(shop.hours)} shopsHref={preset ? `/rent?${packageQuery(preset)}` : "/rent"} />
    </div>
  );
}

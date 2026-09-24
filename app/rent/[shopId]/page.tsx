import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { DroneBookingWizard } from "@/components/droneRental/DroneBookingWizard";

export default async function ShopBookingPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const supabase = createServiceRoleClient();

  const { data: shop } = await supabase
    .from("dr_shops")
    .select("id,name,address,active")
    .eq("id", shopId)
    .maybeSingle();
  if (!shop || !shop.active) notFound();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-8">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">{shop.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">{shop.address}</p>
      </div>
      <DroneBookingWizard shopId={shop.id} />
    </div>
  );
}

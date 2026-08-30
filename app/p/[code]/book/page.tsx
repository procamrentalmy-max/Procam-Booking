import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { BookingWizard } from "./BookingWizard";

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ package?: string }>;
}) {
  const { code } = await params;
  const { package: preselectedPackageId } = await searchParams;
  const supabase = createServiceRoleClient();

  const { data: partner } = await supabase
    .from("partners")
    .select("id,name,referral_code,status")
    .eq("referral_code", code.toUpperCase())
    .maybeSingle();

  if (!partner || partner.status !== "ACTIVE") notFound();

  const { data: packages } = await supabase
    .from("rental_packages")
    .select("id,name,price_myr,deposit_myr,duration_minutes")
    .eq("active", true)
    .order("duration_minutes", { ascending: true });

  return (
    <BookingWizard
      partnerId={partner.id}
      referralCode={partner.referral_code}
      packages={packages ?? []}
      initialPackageId={preselectedPackageId}
    />
  );
}

import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getLocale } from "@/lib/i18n/getLocale";
import { getLogoUrl } from "@/lib/branding";
import { PrintOrderForm } from "./PrintOrderForm";

export default async function PrintPhotosPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const locale = await getLocale();
  const logoUrl = await getLogoUrl();
  const supabase = createServiceRoleClient();

  const { data: partner } = await supabase
    .from("partners")
    .select("name,referral_code,status,photo_print_complimentary")
    .eq("referral_code", code.toUpperCase())
    .maybeSingle();

  if (!partner || partner.status !== "ACTIVE") notFound();

  return (
    <PrintOrderForm
      locale={locale}
      logoUrl={logoUrl}
      referralCode={partner.referral_code}
      hotelName={partner.name}
      complimentary={partner.photo_print_complimentary}
    />
  );
}

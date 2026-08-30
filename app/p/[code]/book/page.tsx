import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getActiveTermsVersion } from "@/lib/booking/terms";
import { BookingWizard } from "./BookingWizard";

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ product?: string }>;
}) {
  const { code } = await params;
  const { product: productId } = await searchParams;
  const supabase = createServiceRoleClient();

  const { data: partner } = await supabase
    .from("partners")
    .select("id,name,referral_code,status")
    .eq("referral_code", code.toUpperCase())
    .maybeSingle();

  if (!partner || partner.status !== "ACTIVE") notFound();

  // Product is chosen on the landing page (product cards) — this route
  // always needs one, it never picks a default.
  if (!productId) redirect(`/p/${partner.referral_code}`);

  const { data: product } = await supabase
    .from("rental_products")
    .select("id,customer_facing_name,requires_phone_compatibility")
    .eq("id", productId)
    .eq("active", true)
    .maybeSingle();
  if (!product) redirect(`/p/${partner.referral_code}`);

  const [{ data: packages }, terms] = await Promise.all([
    supabase
      .from("rental_packages")
      .select("id,name,price_myr,deposit_myr,duration_minutes")
      .eq("product_id", product.id)
      .eq("active", true)
      .order("duration_minutes", { ascending: true }),
    getActiveTermsVersion(product.id),
  ]);

  return (
    <BookingWizard
      partnerId={partner.id}
      referralCode={partner.referral_code}
      productId={product.id}
      productName={product.customer_facing_name}
      requiresPhoneCompatibility={product.requires_phone_compatibility}
      packages={packages ?? []}
      termsVersionId={terms?.id ?? null}
      termsBody={terms?.body ?? null}
    />
  );
}

import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getActiveTermsVersion } from "@/lib/booking/terms";
import { logFunnelEvent } from "@/lib/funnel";
import { getLocale } from "@/lib/i18n/getLocale";
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
  const locale = await getLocale();
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

  const [{ data: packages }, { data: lockerPartners }, terms] = await Promise.all([
    supabase
      .from("rental_packages")
      .select("id,name,price_myr,deposit_myr,duration_minutes,is_overnight")
      .eq("product_id", product.id)
      .eq("active", true)
      .order("duration_minutes", { ascending: true }),
    // Every active locker location is a valid pickup/dropoff choice — the
    // worker moves cameras between them, so a booking isn't limited to
    // wherever this particular product's assets currently happen to sit.
    supabase.from("partners").select("id,name").eq("pickup_method", "LOCKER").eq("status", "ACTIVE").order("name"),
    getActiveTermsVersion(product.id),
  ]);

  await logFunnelEvent("WIZARD_OPENED", partner.id);

  return (
    <BookingWizard
      locale={locale}
      partnerId={partner.id}
      referralCode={partner.referral_code}
      productId={product.id}
      productName={product.customer_facing_name}
      requiresPhoneCompatibility={product.requires_phone_compatibility}
      packages={packages ?? []}
      lockerPartners={lockerPartners ?? []}
      termsVersionId={terms?.id ?? null}
      termsBody={terms?.body ?? null}
    />
  );
}

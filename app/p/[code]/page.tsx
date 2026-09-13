import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { logFunnelEvent } from "@/lib/funnel";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLogoUrl } from "@/lib/branding";
import { Brand } from "@/components/Brand";

export default async function PartnerLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const logoUrl = await getLogoUrl();
  const supabase = createServiceRoleClient();

  const { data: partner } = await supabase
    .from("partners")
    .select("id,name,referral_code,status")
    .eq("referral_code", code.toUpperCase())
    .maybeSingle();

  if (!partner || partner.status !== "ACTIVE") notFound();

  await logFunnelEvent("LANDING_VIEWED", partner.id);

  // Only products with actual deployed inventory at this property are
  // offered — a property with no SeaLife units never shows that card,
  // even if SeaLife exists as a product elsewhere.
  const { data: assetsHere } = await supabase
    .from("rental_assets")
    .select("product_id,status")
    .eq("partner_id", partner.id);
  const productIdsHere = [...new Set((assetsHere ?? []).filter((a) => a.status !== "RETIRED").map((a) => a.product_id))];

  const { data: products } = productIdsHere.length
    ? await supabase
        .from("rental_products")
        .select("id,slug,customer_facing_name,tagline")
        .eq("active", true)
        .in("id", productIdsHere)
    : { data: [] };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="flex flex-col items-center text-center">
        <Brand logoUrl={logoUrl} size={36} />
        <p className="mt-2 text-sm text-zinc-500">{dict.landing.equipmentRentalAt(partner.name)}</p>
        <p className="mt-3 rounded-full bg-black/5 px-4 py-2 text-xs font-medium text-black dark:bg-white/10 dark:text-zinc-50">
          {dict.landing.usp}
        </p>
      </div>

      <div className="space-y-3">
        {(products ?? []).map((product) => (
          <Link
            key={product.id}
            href={`/p/${partner.referral_code}/book?product=${product.id}`}
            className="block rounded-xl border border-zinc-200 p-4 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
          >
            <p className="font-medium text-black dark:text-zinc-50">{product.customer_facing_name}</p>
            {product.tagline && <p className="text-sm text-zinc-500">{product.tagline}</p>}
          </Link>
        ))}
        {!(products ?? []).length && (
          <p className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-500 dark:border-zinc-800">
            {dict.landing.noEquipment}
          </p>
        )}
      </div>

      <Link href="/terms" className="text-center text-xs text-zinc-400 underline underline-offset-2">
        {dict.common.termsAndConditions}
      </Link>
    </div>
  );
}

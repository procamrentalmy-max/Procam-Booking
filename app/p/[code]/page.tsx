import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";

export default async function PartnerLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = createServiceRoleClient();

  const { data: partner } = await supabase
    .from("partners")
    .select("id,name,referral_code,status")
    .eq("referral_code", code.toUpperCase())
    .maybeSingle();

  if (!partner || partner.status !== "ACTIVE") notFound();

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
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">ProCam</h1>
        <p className="mt-1 text-sm text-zinc-500">Equipment rental at {partner.name}</p>
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
            No equipment is currently set up at this property.
          </p>
        )}
      </div>
    </div>
  );
}

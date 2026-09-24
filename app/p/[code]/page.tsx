import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { logFunnelEvent } from "@/lib/funnel";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLogoUrl } from "@/lib/branding";
import { getProductImageUrl } from "@/lib/storage";
import { Brand } from "@/components/Brand";
import { CategorySection, type CategoryProduct } from "./CategorySection";

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

  // Every active product is offered at every active locker — the fleet is
  // pooled, not tied to a location (see lib/locker-engine/bookingGate.ts):
  // a camera not currently sitting here doesn't mean it can't be booked
  // here, since the worker relocates whichever unit is eligible to wherever
  // it's needed. Gating this list on which units currently happen to be
  // parked at this property would just hide bookable products for no reason.
  const { data: products } = await supabase
    .from("rental_products")
    .select("id,slug,customer_facing_name,tagline,category,image_path")
    .eq("active", true);

  const referralCode = partner.referral_code;
  function toCategoryProduct(product: NonNullable<typeof products>[number]): CategoryProduct {
    return {
      id: product.id,
      href: `/p/${referralCode}/book?product=${product.id}`,
      name: product.customer_facing_name,
      tagline: product.tagline,
      imageUrl: product.image_path ? getProductImageUrl(product.image_path) : null,
    };
  }

  // Drones now book through the merchant-mediated flow (app/rent) instead
  // of the self-service locker wizard every other product still uses —
  // fixed shop pickup, staff-taken condition photos, no lockers. /rent
  // isn't scoped to this partner/referral code (it has its own shop picker
  // with its own map), so this just routes in rather than reusing
  // toCategoryProduct's `/p/[code]/book` href.
  const drones = (products ?? [])
    .filter((p) => p.category === "DRONE")
    .map((p) => ({
      id: p.id,
      href: "/rent",
      name: p.customer_facing_name,
      tagline: p.tagline,
      imageUrl: p.image_path ? getProductImageUrl(p.image_path) : null,
    }));
  const cameras = (products ?? []).filter((p) => p.category === "CAMERA").map(toCategoryProduct);

  // Not a rental_products row on purpose — printing has no pickup, dropoff,
  // or deposit, so it doesn't belong in the camera-rental booking wizard.
  // It's a distinct service, always offered as its own "Photos" category.
  const photos: CategoryProduct[] = [
    {
      id: "print-service",
      href: `/p/${referralCode}/print`,
      name: dict.landing.printService.name,
      tagline: dict.landing.printService.tagline,
      imageUrl: null,
    },
  ];

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
        <CategorySection label={dict.landing.categories.drones} products={drones} />
        <CategorySection label={dict.landing.categories.cameras} products={cameras} />
        <CategorySection label={dict.landing.categories.photos} products={photos} />
        {!drones.length && !cameras.length && (
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

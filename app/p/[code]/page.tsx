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

  // Every active product is offered at every active locker — the fleet is
  // pooled, not tied to a location (see lib/locker-engine/bookingGate.ts):
  // a camera not currently sitting here doesn't mean it can't be booked
  // here, since the worker relocates whichever unit is eligible to wherever
  // it's needed. Gating this list on which units currently happen to be
  // parked at this property would just hide bookable products for no reason.
  const { data: products } = await supabase
    .from("rental_products")
    .select("id,slug,customer_facing_name,tagline")
    .eq("active", true);

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

        {/* Not a rental_products row on purpose — printing has no pickup,
            dropoff, or deposit, so it doesn't belong in the camera-rental
            booking wizard. It's a distinct service, always offered
            alongside whatever cameras are listed above. */}
        <Link
          href={`/p/${partner.referral_code}/print`}
          className="block rounded-xl border border-zinc-200 p-4 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
        >
          <p className="font-medium text-black dark:text-zinc-50">{dict.landing.printService.name}</p>
          <p className="text-sm text-zinc-500">{dict.landing.printService.tagline}</p>
        </Link>
      </div>

      <Link href="/terms" className="text-center text-xs text-zinc-400 underline underline-offset-2">
        {dict.common.termsAndConditions}
      </Link>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { countAvailableCameras } from "@/lib/booking/availability";

export default async function PartnerLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = createServiceRoleClient();

  const { data: partner } = await supabase
    .from("partners")
    .select("id,name,referral_code,status")
    .eq("referral_code", code.toUpperCase())
    .maybeSingle();

  if (!partner || partner.status !== "ACTIVE") notFound();

  const [{ data: packages }, availableCount] = await Promise.all([
    supabase
      .from("rental_packages")
      .select("id,name,price_myr,deposit_myr,duration_minutes")
      .eq("active", true)
      .order("duration_minutes", { ascending: true }),
    countAvailableCameras(partner.id),
  ]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">ProCam</h1>
        <p className="mt-1 text-sm text-zinc-500">Action camera rental at {partner.name}</p>
      </div>

      {availableCount === 0 ? (
        <p className="rounded-xl border border-zinc-200 p-4 text-center text-sm text-zinc-500 dark:border-zinc-800">
          Sorry, all cameras are rented out right now. Please check back later or ask reception when the next one is
          expected back.
        </p>
      ) : (
        <div className="space-y-3">
          {(packages ?? []).map((pkg) => (
            <div
              key={pkg.id}
              className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div>
                <p className="font-medium">{pkg.name}</p>
                <p className="text-sm text-zinc-500">RM{pkg.deposit_myr} refundable deposit</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">RM{pkg.price_myr}</p>
              </div>
            </div>
          ))}

          <Link
            href={`/p/${partner.referral_code}/book`}
            className="flex h-14 items-center justify-center rounded-full bg-black text-base font-semibold text-white dark:bg-white dark:text-black"
          >
            Book Now
          </Link>
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { countAvailableAssets } from "@/lib/booking/availability";

export default async function PartnerLandingPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = createServiceRoleClient();

  const { data: partner } = await supabase
    .from("partners")
    .select("id,name,referral_code,status")
    .eq("referral_code", code.toUpperCase())
    .maybeSingle();

  if (!partner || partner.status !== "ACTIVE") notFound();

  const [{ data: packages }, availableNowCount] = await Promise.all([
    supabase
      .from("rental_packages")
      .select("id,name,price_myr,deposit_myr,duration_minutes")
      .eq("active", true)
      .order("duration_minutes", { ascending: true }),
    countAvailableAssets(partner.id),
  ]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">ProCam</h1>
        <p className="mt-1 text-sm text-zinc-500">Equipment rental at {partner.name}</p>
        {/*
          Advisory only, not a hard gate: an asset busy right now can still
          have a free slot later today, and the booking wizard lets you pick
          any time. The real availability check happens when you actually
          request a slot (createPendingBooking) — this is just a hint.
        */}
        <p className="mt-2 text-xs text-zinc-400">
          {availableNowCount > 0
            ? `${availableNowCount} item${availableNowCount === 1 ? "" : "s"} available right now`
            : "Everything is out right now — you can still book a later time today"}
        </p>
      </div>

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
    </div>
  );
}

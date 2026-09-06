import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEvidencePhotoSignedUrl } from "@/lib/storage";
import { primaryButtonClass } from "@/components/formStyles";
import { DamageCaseResolutionForm } from "./DamageCaseResolutionForm";
import { markDamageCaseUnderReviewAction } from "./actions";

export default async function DamageCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: damageCase } = await supabase
    .from("damage_cases")
    .select("id,inspection_id,booking_id,category,description,status,resolution_notes,deposit_action")
    .eq("id", id)
    .maybeSingle();
  if (!damageCase) notFound();

  const [{ data: inspection }, { data: booking }] = await Promise.all([
    supabase.from("inspections").select("checklist,notes,created_at").eq("id", damageCase.inspection_id).single(),
    supabase
      .from("bookings")
      .select("id,human_id,asset_id,customer_id,late_fee_myr,start_time,end_time,actual_return_time")
      .eq("id", damageCase.booking_id)
      .single(),
  ]);
  if (!booking) notFound();

  const [{ data: asset }, { data: customer }, { data: deposit }, { data: returnCheck }] = await Promise.all([
    supabase.from("rental_assets").select("human_id,product_id").eq("id", booking.asset_id).single(),
    supabase.from("customers").select("name,email,phone").eq("id", booking.customer_id).single(),
    supabase
      .from("deposit_authorizations")
      .select("id,provider_ref,amount_myr,status")
      .eq("booking_id", booking.id)
      .maybeSingle(),
    supabase
      .from("condition_checks")
      .select("id,damage_description")
      .eq("booking_id", booking.id)
      .eq("type", "RETURN")
      .maybeSingle(),
  ]);

  let photoUrls: string[] = [];
  if (returnCheck) {
    const { data: photos } = await supabase
      .from("condition_photos")
      .select("storage_path")
      .eq("condition_check_id", returnCheck.id);
    photoUrls = await Promise.all((photos ?? []).map((p) => getEvidencePhotoSignedUrl(p.storage_path)));
  }

  const { data: damagePhotos } = await supabase
    .from("damage_case_photos")
    .select("storage_path")
    .eq("damage_case_id", damageCase.id);
  const damagePhotoUrls = await Promise.all((damagePhotos ?? []).map((p) => getEvidencePhotoSignedUrl(p.storage_path)));

  const resolved = damageCase.status === "RESOLVED";

  return (
    <div className="space-y-6 pt-4 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">
            {asset?.human_id ?? "Unknown asset"} — Booking {booking.human_id}
          </h1>
          <p className="text-sm text-zinc-500">
            {customer?.name} — {customer?.email} — {customer?.phone}
          </p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-400">{damageCase.status}</p>
        </div>

        {damageCase.status === "OPEN" && (
          <form action={markDamageCaseUnderReviewAction}>
            <input type="hidden" name="damageCaseId" value={damageCase.id} />
            <button type="submit" className={primaryButtonClass}>
              Mark Under Review
            </button>
          </form>
        )}
      </div>

      <section className="rounded-xl border border-red-200 p-4 dark:border-red-900">
        <h2 className="mb-1 text-sm font-semibold text-zinc-500">Damage Reported</h2>
        <p className="font-medium">{damageCase.category.replace(/_/g, " ")}</p>
        <p className="text-sm">{damageCase.description}</p>
      </section>

      {damagePhotoUrls.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-500">Damage Photos (from staff)</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {damagePhotoUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not optimizable
              <img key={i} src={url} alt="Reported damage" className="aspect-square w-full rounded-lg object-cover" />
            ))}
          </div>
        </section>
      )}

      {inspection?.notes && (
        <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-1 text-sm font-semibold text-zinc-500">Inspector Notes</h2>
          <p className="text-sm">{inspection.notes}</p>
        </section>
      )}

      {returnCheck?.damage_description && (
        <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-1 text-sm font-semibold text-zinc-500">Customer&apos;s Own Return Report</h2>
          <p className="text-sm">{returnCheck.damage_description}</p>
        </section>
      )}

      {photoUrls.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-zinc-500">Return Condition Photos</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {photoUrls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not optimizable
              <img key={i} src={url} alt="Return condition" className="aspect-square w-full rounded-lg object-cover" />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-1 text-sm font-semibold text-zinc-500">Booking &amp; Deposit</h2>
        <p className="text-sm">
          Scheduled: {new Date(booking.start_time).toLocaleString()} &rarr; {new Date(booking.end_time).toLocaleString()}
        </p>
        {booking.actual_return_time && (
          <p className="text-sm">Actually returned: {new Date(booking.actual_return_time).toLocaleString()}</p>
        )}
        {Number(booking.late_fee_myr) > 0 && (
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Outstanding late fee: RM{Number(booking.late_fee_myr).toFixed(2)} (not yet captured — will be combined
            with your decision below)
          </p>
        )}
        {deposit ? (
          <p className="text-sm">
            Deposit held: RM{Number(deposit.amount_myr).toFixed(2)} — status {deposit.status}
          </p>
        ) : (
          <p className="text-sm text-red-600">No deposit hold found for this booking.</p>
        )}
      </section>

      {resolved ? (
        <section className="rounded-xl border border-green-200 p-4 dark:border-green-900">
          <h2 className="mb-1 text-sm font-semibold text-zinc-500">Resolved</h2>
          <p className="text-sm">Deposit action: {damageCase.deposit_action}</p>
          {damageCase.resolution_notes && <p className="mt-1 text-sm">{damageCase.resolution_notes}</p>}
        </section>
      ) : deposit ? (
        <DamageCaseResolutionForm
          damageCaseId={damageCase.id}
          bookingId={booking.id}
          depositAmountMyr={Number(deposit.amount_myr)}
          lateFeeMyr={Number(booking.late_fee_myr)}
        />
      ) : null}

      <p className="text-xs text-zinc-400">
        Once repaired, clear the asset back into the fleet from{" "}
        <Link href="/admin/rental-assets" className="underline underline-offset-2">
          Rental Assets
        </Link>
        .
      </p>
    </div>
  );
}

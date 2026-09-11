import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEvidencePhotoSignedUrl } from "@/lib/storage";

type TimelineEvent = {
  ts: string;
  source: string;
  label: string;
  detail?: string;
  photoUrl?: string;
};

const SOURCE_LABEL: Record<string, string> = {
  booking: "Booking",
  condition_check: "Condition Check",
  photo: "Photo",
  asset_event: "Asset Event",
  notification: "Notification",
  payment: "Payment",
  inspection: "Inspection",
  damage_case: "Damage Case",
  deposit: "Deposit",
  commission: "Commission",
};

/**
 * A read-only, chronological merge of every record a booking touches —
 * booking lifecycle, condition-check photos, asset status transitions,
 * payments, inspection/damage, deposit and commission events — pulled
 * live from each table rather than kept as a separate log. Nothing here
 * is a new source of truth; it's a view over the existing tables.
 */
export default async function BookingTimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "id,human_id,status,start_time,end_time,actual_pickup_time,actual_return_time,late_fee_myr,customer_id,partner_id,dropoff_partner_id,asset_id,created_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (!booking) notFound();

  const [
    { data: customer },
    { data: partner },
    { data: dropoffPartner },
    { data: asset },
    { data: conditionChecks },
    { data: assetEvents },
    { data: notifications },
    { data: payments },
    { data: inspections },
    { data: damageCases },
    { data: deposits },
    { data: commissions },
  ] = await Promise.all([
    supabase.from("customers").select("name,email,phone").eq("id", booking.customer_id).maybeSingle(),
    supabase.from("partners").select("name").eq("id", booking.partner_id).maybeSingle(),
    supabase.from("partners").select("name").eq("id", booking.dropoff_partner_id).maybeSingle(),
    supabase.from("rental_assets").select("human_id").eq("id", booking.asset_id).maybeSingle(),
    supabase
      .from("condition_checks")
      .select("id,type,damage_reported,damage_description,created_at")
      .eq("booking_id", id),
    supabase
      .from("asset_events")
      .select("id,event_type,from_status,to_status,actor_type,created_at")
      .eq("booking_id", id),
    supabase.from("notifications").select("id,channel,template,status,created_at").eq("booking_id", id),
    supabase.from("payments").select("id,kind,amount_myr,status,created_at").eq("booking_id", id),
    supabase.from("inspections").select("id,result,notes,created_at").eq("booking_id", id),
    supabase.from("damage_cases").select("id,category,description,status,created_at").eq("booking_id", id),
    supabase
      .from("deposit_authorizations")
      .select("id,amount_myr,status,created_at,resolved_at")
      .eq("booking_id", id),
    supabase.from("commissions").select("id,commission_amount_myr,status,created_at").eq("booking_id", id),
  ]);

  const checkIds = (conditionChecks ?? []).map((c) => c.id);
  const { data: photos } = checkIds.length
    ? await supabase
        .from("condition_photos")
        .select("id,condition_check_id,storage_path,check_template_item_id,created_at")
        .in("condition_check_id", checkIds)
    : { data: [] };

  const templateItemIds = [...new Set((photos ?? []).map((p) => p.check_template_item_id).filter(Boolean))];
  const { data: templateItems } = templateItemIds.length
    ? await supabase.from("check_templates").select("id,label").in("id", templateItemIds)
    : { data: [] };
  const labelByTemplateId = new Map((templateItems ?? []).map((t) => [t.id, t.label]));
  const checkById = new Map((conditionChecks ?? []).map((c) => [c.id, c]));

  const photosWithUrls = await Promise.all(
    (photos ?? []).map(async (p) => ({ ...p, url: await getEvidencePhotoSignedUrl(p.storage_path) }))
  );

  const events: TimelineEvent[] = [];

  events.push({
    ts: booking.created_at,
    source: "booking",
    label: "Booking created",
    detail: `${new Date(booking.start_time).toLocaleString()} → ${new Date(booking.end_time).toLocaleString()}`,
  });
  if (booking.actual_pickup_time) {
    events.push({ ts: booking.actual_pickup_time, source: "booking", label: "Pickup recorded" });
  }
  if (booking.actual_return_time) {
    events.push({
      ts: booking.actual_return_time,
      source: "booking",
      label: "Return recorded",
      detail: Number(booking.late_fee_myr) > 0 ? `Late fee: RM${Number(booking.late_fee_myr).toFixed(2)}` : undefined,
    });
  }

  for (const c of conditionChecks ?? []) {
    events.push({
      ts: c.created_at,
      source: "condition_check",
      label: `${c.type === "PRE_RENTAL" ? "Pre-rental" : "Return"} condition check started`,
      detail: c.damage_reported ? `Customer reported: ${c.damage_description}` : "No issues reported",
    });
  }
  for (const p of photosWithUrls) {
    const check = checkById.get(p.condition_check_id);
    events.push({
      ts: p.created_at,
      source: "photo",
      label: `Photo: ${labelByTemplateId.get(p.check_template_item_id) ?? "photo"} (${check?.type === "PRE_RENTAL" ? "pickup" : "return"})`,
      photoUrl: p.url,
    });
  }
  for (const e of assetEvents ?? []) {
    events.push({
      ts: e.created_at,
      source: "asset_event",
      label: e.event_type.replace(/_/g, " "),
      detail: `${e.from_status} → ${e.to_status} (${e.actor_type})`,
    });
  }
  for (const n of notifications ?? []) {
    events.push({ ts: n.created_at, source: "notification", label: `${n.channel} sent`, detail: `${n.template} — ${n.status}` });
  }
  for (const p of payments ?? []) {
    events.push({
      ts: p.created_at,
      source: "payment",
      label: `Payment: ${p.kind.replace(/_/g, " ")}`,
      detail: `RM${Number(p.amount_myr).toFixed(2)} — ${p.status}`,
    });
  }
  for (const i of inspections ?? []) {
    events.push({ ts: i.created_at, source: "inspection", label: `Inspection: ${i.result}`, detail: i.notes || undefined });
  }
  for (const d of damageCases ?? []) {
    events.push({
      ts: d.created_at,
      source: "damage_case",
      label: `Damage case opened: ${d.category.replace(/_/g, " ")}`,
      detail: d.description,
    });
  }
  for (const d of deposits ?? []) {
    events.push({
      ts: d.created_at,
      source: "deposit",
      label: "Deposit authorized",
      detail: `RM${Number(d.amount_myr).toFixed(2)} — ${d.status}`,
    });
    if (d.resolved_at) events.push({ ts: d.resolved_at, source: "deposit", label: "Deposit resolved", detail: d.status });
  }
  for (const c of commissions ?? []) {
    events.push({
      ts: c.created_at,
      source: "commission",
      label: "Commission accrued",
      detail: `RM${Number(c.commission_amount_myr).toFixed(2)} — ${c.status}`,
    });
  }

  events.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  return (
    <div className="space-y-6 pt-4 pb-10">
      <div>
        <Link href="/admin/bookings" className="text-xs text-zinc-400 underline underline-offset-2">
          ← All bookings
        </Link>
        <h1 className="mt-1 text-lg font-semibold">
          {booking.human_id} — <span className="font-normal text-zinc-500">{booking.status}</span>
        </h1>
        <p className="text-sm text-zinc-500">
          {customer?.name} — {customer?.email} — {customer?.phone}
        </p>
        <p className="text-sm text-zinc-500">
          {asset?.human_id} — {partner?.name}
          {booking.dropoff_partner_id !== booking.partner_id && <> → {dropoffPartner?.name}</>}
        </p>
      </div>

      <div>
        {events.map((e, i) => (
          <div key={i} className="flex gap-3 border-t border-zinc-100 py-3 first:border-t-0 dark:border-zinc-900">
            <div className="w-36 shrink-0 text-xs text-zinc-400">{new Date(e.ts).toLocaleString()}</div>
            <div className="flex-1 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                {SOURCE_LABEL[e.source] ?? e.source}
              </p>
              <p className="text-sm font-medium">{e.label}</p>
              {e.detail && <p className="text-sm text-zinc-500">{e.detail}</p>}
              {e.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not optimizable
                <img src={e.photoUrl} alt={e.label} className="mt-1 h-24 w-24 rounded-lg object-cover" />
              )}
            </div>
          </div>
        ))}
        {!events.length && <p className="text-sm text-zinc-400">No activity recorded yet.</p>}
      </div>
    </div>
  );
}

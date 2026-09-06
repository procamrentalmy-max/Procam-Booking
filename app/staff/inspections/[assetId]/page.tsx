import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEvidencePhotoSignedUrl } from "@/lib/storage";
import { InspectionForm } from "./InspectionForm";

export default async function InspectionDetailPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: asset } = await supabase
    .from("rental_assets")
    .select("id,human_id,status,product_id")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset || asset.status !== "RETURNED_AWAITING_INSPECTION") notFound();

  const { data: product } = await supabase
    .from("rental_products")
    .select("slug,customer_facing_name")
    .eq("id", asset.product_id)
    .single();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id,human_id,late_fee_myr")
    .eq("asset_id", assetId)
    .eq("status", "AWAITING_INSPECTION")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!booking) notFound();

  const [{ data: checks }, { data: preRentalTemplates }, { data: returnTemplates }, { data: checklistTemplates }] =
    await Promise.all([
      supabase.from("condition_checks").select("id,type,damage_reported,damage_description").eq("booking_id", booking.id),
      supabase
        .from("check_templates")
        .select("id,item_key,label")
        .eq("product_id", asset.product_id)
        .eq("phase", "PRE_RENTAL")
        .eq("input_type", "PHOTO"),
      supabase
        .from("check_templates")
        .select("id,item_key,label")
        .eq("product_id", asset.product_id)
        .eq("phase", "RETURN")
        .eq("input_type", "PHOTO"),
      supabase
        .from("check_templates")
        .select("item_key,label")
        .eq("product_id", asset.product_id)
        .eq("phase", "STAFF_INSPECTION")
        .eq("input_type", "BOOLEAN")
        .eq("active", true)
        .order("sort_order", { ascending: true }),
    ]);

  const preRentalCheck = checks?.find((c) => c.type === "PRE_RENTAL");
  const returnCheck = checks?.find((c) => c.type === "RETURN");
  const checkIds = [preRentalCheck?.id, returnCheck?.id].filter((id): id is string => Boolean(id));

  const { data: photos } = checkIds.length
    ? await supabase
        .from("condition_photos")
        .select("condition_check_id,check_template_item_id,storage_path")
        .in("condition_check_id", checkIds)
    : { data: [] };

  const preTemplateById = new Map((preRentalTemplates ?? []).map((t) => [t.id, t]));
  const returnTemplateById = new Map((returnTemplates ?? []).map((t) => [t.id, t]));

  const preSignedByKey: Record<string, string> = {};
  const returnSignedByKey: Record<string, string> = {};
  for (const photo of photos ?? []) {
    const url = await getEvidencePhotoSignedUrl(photo.storage_path);
    if (photo.condition_check_id === preRentalCheck?.id) {
      const template = preTemplateById.get(photo.check_template_item_id);
      if (template) preSignedByKey[template.item_key] = url;
    } else if (photo.condition_check_id === returnCheck?.id) {
      const template = returnTemplateById.get(photo.check_template_item_id);
      if (template) returnSignedByKey[template.item_key] = url;
    }
  }

  // Item keys are shared between the PRE_RENTAL and RETURN template rows
  // for a product (same photo concept, two separate template rows — one
  // per phase) — union them so a photo present on only one side still shows.
  const photoItemKeys = [
    ...new Map(
      [...(preRentalTemplates ?? []), ...(returnTemplates ?? [])].map((t) => [t.item_key, t.label])
    ).entries(),
  ];

  return (
    <InspectionForm
      assetId={asset.id}
      assetHumanId={asset.human_id}
      productSlug={product?.slug ?? ""}
      productName={product?.customer_facing_name ?? "Equipment"}
      bookingId={booking.id}
      bookingHumanId={booking.human_id}
      photoItems={photoItemKeys.map(([key, label]) => ({
        key,
        label,
        preUrl: preSignedByKey[key],
        returnUrl: returnSignedByKey[key],
      }))}
      checklistItems={(checklistTemplates ?? []).map((t) => ({ key: t.item_key, label: t.label }))}
      damageReported={returnCheck?.damage_reported ?? false}
      damageDescription={returnCheck?.damage_description ?? null}
      lateFeeMyr={booking.late_fee_myr}
    />
  );
}

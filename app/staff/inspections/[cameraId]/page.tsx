import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getConditionPhotoSignedUrl } from "@/lib/storage";
import { InspectionForm } from "./InspectionForm";

export default async function InspectionDetailPage({ params }: { params: Promise<{ cameraId: string }> }) {
  const { cameraId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: camera } = await supabase
    .from("cameras")
    .select("id,human_id,status")
    .eq("id", cameraId)
    .maybeSingle();
  if (!camera || camera.status !== "RETURNED_AWAITING_INSPECTION") notFound();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id,human_id")
    .eq("camera_id", cameraId)
    .eq("status", "AWAITING_INSPECTION")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!booking) notFound();

  const { data: checks } = await supabase
    .from("condition_checks")
    .select("id,type,damage_reported,damage_description")
    .eq("booking_id", booking.id);

  const preRentalCheck = checks?.find((c) => c.type === "PRE_RENTAL");
  const returnCheck = checks?.find((c) => c.type === "RETURN");
  const checkIds = [preRentalCheck?.id, returnCheck?.id].filter((id): id is string => Boolean(id));

  const { data: photos } = checkIds.length
    ? await supabase.from("condition_photos").select("condition_check_id,photo_type,storage_path").in("condition_check_id", checkIds)
    : { data: [] };

  const signedUrls: Record<string, string> = {};
  for (const photo of photos ?? []) {
    const side = photo.condition_check_id === preRentalCheck?.id ? "pre" : "return";
    signedUrls[`${side}_${photo.photo_type}`] = await getConditionPhotoSignedUrl(photo.storage_path);
  }

  return (
    <InspectionForm
      cameraId={camera.id}
      cameraHumanId={camera.human_id}
      bookingId={booking.id}
      bookingHumanId={booking.human_id}
      photos={signedUrls}
      damageReported={returnCheck?.damage_reported ?? false}
      damageDescription={returnCheck?.damage_description ?? null}
    />
  );
}

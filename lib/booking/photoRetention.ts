import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";

const PHOTOS_BUCKET = "condition-photos";

/** How many of a camera's most recent bookings keep their condition photos. */
export const RETAINED_BOOKINGS_PER_ASSET = 5;

/**
 * Deletes condition photos — both the Storage files and their
 * condition_photos rows — for every booking beyond the
 * RETAINED_BOOKINGS_PER_ASSET most recent per camera, ranked by the
 * booking's own start_time. Nothing else about an old booking is touched:
 * the booking row, its condition_checks metadata (type, damage_reported,
 * damage_description), asset_events, payments, etc. all stay forever —
 * only the photo evidence is pruned, since that's the one thing that
 * actually grows storage usage without bound.
 */
export async function pruneOldConditionPhotos(): Promise<{
  staleBookings: number;
  deletedPhotos: number;
  errors: string[];
}> {
  const supabase = createServiceRoleClient();
  const errors: string[] = [];

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id,asset_id,start_time")
    .order("asset_id", { ascending: true })
    .order("start_time", { ascending: false });

  const staleBookingIds: string[] = [];
  let currentAssetId: string | null = null;
  let countForAsset = 0;
  for (const b of bookings ?? []) {
    if (b.asset_id !== currentAssetId) {
      currentAssetId = b.asset_id;
      countForAsset = 0;
    }
    countForAsset += 1;
    if (countForAsset > RETAINED_BOOKINGS_PER_ASSET) staleBookingIds.push(b.id);
  }

  if (staleBookingIds.length === 0) {
    return { staleBookings: 0, deletedPhotos: 0, errors };
  }

  const { data: staleChecks } = await supabase
    .from("condition_checks")
    .select("id")
    .in("booking_id", staleBookingIds);
  const staleCheckIds = (staleChecks ?? []).map((c) => c.id);
  if (staleCheckIds.length === 0) {
    return { staleBookings: staleBookingIds.length, deletedPhotos: 0, errors };
  }

  const { data: stalePhotos } = await supabase
    .from("condition_photos")
    .select("id,storage_path")
    .in("condition_check_id", staleCheckIds);
  if (!stalePhotos?.length) {
    return { staleBookings: staleBookingIds.length, deletedPhotos: 0, errors };
  }

  const paths = stalePhotos.map((p) => p.storage_path);
  const { error: removeError } = await supabase.storage.from(PHOTOS_BUCKET).remove(paths);
  if (removeError) errors.push(`Storage removal: ${removeError.message}`);

  const { error: deleteError } = await supabase
    .from("condition_photos")
    .delete()
    .in(
      "id",
      stalePhotos.map((p) => p.id)
    );
  if (deleteError) errors.push(`condition_photos delete: ${deleteError.message}`);

  return { staleBookings: staleBookingIds.length, deletedPhotos: stalePhotos.length, errors };
}

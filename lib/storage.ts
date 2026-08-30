import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";

const CONDITION_PHOTOS_BUCKET = "condition-photos";

export function conditionPhotoPath(
  bookingId: string,
  checkType: "pre-rental" | "return",
  itemKey: string
): string {
  return `${bookingId}/${checkType}/${itemKey}.jpg`;
}

export async function uploadConditionPhoto(path: string, file: File): Promise<void> {
  const supabase = createServiceRoleClient();
  // upsert: true so a retry after a partial failure (see submit actions)
  // overwrites the same path instead of erroring on "already exists".
  const { error } = await supabase.storage
    .from(CONDITION_PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw new Error(`Failed to upload photo: ${error.message}`);
}

/** Staff/admin inspection screens use this rather than ever exposing the bucket publicly. */
export async function getConditionPhotoSignedUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(CONDITION_PHOTOS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new Error(`Failed to sign photo URL: ${error?.message ?? "unknown error"}`);
  return data.signedUrl;
}

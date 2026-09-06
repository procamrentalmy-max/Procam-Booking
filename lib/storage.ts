import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";

// One private bucket for every piece of photo evidence (pre-rental/return
// condition photos, ID documents, and staff-captured damage photos) — see
// 0004_storage.sql. All upload/read goes through server code using the
// service-role client; customers never get a Supabase session to upload
// with directly, and staff/admin view photos via signed URLs.
const EVIDENCE_PHOTOS_BUCKET = "condition-photos";

export function conditionPhotoPath(
  bookingId: string,
  checkType: "pre-rental" | "return",
  itemKey: string
): string {
  return `${bookingId}/${checkType}/${itemKey}.jpg`;
}

export function damagePhotoPath(damageCaseId: string, index: number): string {
  return `damage-cases/${damageCaseId}/photo-${index}.jpg`;
}

export async function uploadEvidencePhoto(path: string, file: File): Promise<void> {
  const supabase = createServiceRoleClient();
  // upsert: true so a retry after a partial failure (see submit actions)
  // overwrites the same path instead of erroring on "already exists".
  const { error } = await supabase.storage
    .from(EVIDENCE_PHOTOS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw new Error(`Failed to upload photo: ${error.message}`);
}

/** Staff/admin screens use this rather than ever exposing the bucket publicly. */
export async function getEvidencePhotoSignedUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(EVIDENCE_PHOTOS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new Error(`Failed to sign photo URL: ${error?.message ?? "unknown error"}`);
  return data.signedUrl;
}

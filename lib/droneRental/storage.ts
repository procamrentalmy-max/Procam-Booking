import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";

const CHECKLIST_PHOTOS_BUCKET = "drone-checklist-photos";

export function checklistPhotoPath(bookingId: string, phase: "pickup" | "return", index: number): string {
  return `${bookingId}/${phase}/photo-${index}.jpg`;
}

export async function uploadChecklistPhoto(path: string, file: File): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.storage.from(CHECKLIST_PHOTOS_BUCKET).upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw new Error(`Failed to upload photo: ${error.message}`);
}

/** Admin/merchant screens use this rather than ever exposing the bucket publicly. */
export async function getChecklistPhotoSignedUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage.from(CHECKLIST_PHOTOS_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new Error(`Failed to sign photo URL: ${error?.message ?? "unknown error"}`);
  return data.signedUrl;
}

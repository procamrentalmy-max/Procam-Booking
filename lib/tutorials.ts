import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { BRANDING_BUCKET } from "@/lib/branding";
import type { TutorialSectionData } from "@/lib/tutorialMedia";

/** Every header with its photos and videos, in the order the admin set them (Admin > Tutorials). */
export async function getTutorialSections(): Promise<TutorialSectionData[]> {
  const supabase = createServiceRoleClient();
  const [{ data: sections }, { data: media }] = await Promise.all([
    supabase.from("tutorial_sections").select("id,title,position,created_at").order("position").order("created_at"),
    supabase.from("tutorial_media").select("id,section_id,kind,file_path,caption,position,created_at").order("position").order("created_at"),
  ]);
  return (sections ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    media: (media ?? [])
      .filter((m) => m.section_id === s.id)
      .map((m) => ({ id: m.id, kind: m.kind, url: supabase.storage.from(BRANDING_BUCKET).getPublicUrl(m.file_path).data.publicUrl, caption: m.caption })),
  }));
}

/** Whether the Tutorial page has anything to show yet: it is only linked from the landing page once it does. */
export async function hasTutorial(): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { count } = await supabase.from("tutorial_media").select("id", { count: "exact", head: true });
  return (count ?? 0) > 0;
}

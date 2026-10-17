import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { BRANDING_BUCKET } from "@/lib/branding";
import type { TutorialSectionData } from "@/lib/tutorialMedia";

/** Every header of one tutorial with its photos and videos, in the order the admin set them (Admin > Tutorials). */
/** The two tutorials: for flying with your phone, and for flying with the controller. */
export const TUTORIAL_AUDIENCES = ["PHONE", "CONTROLLER"] as const;
export type TutorialAudience = (typeof TUTORIAL_AUDIENCES)[number];

/** "phone" and "controller" in the address of the tutorial and admin pages. */
export function audienceFromSlug(slug: string): TutorialAudience | null {
  const upper = slug.toUpperCase();
  return (TUTORIAL_AUDIENCES as readonly string[]).includes(upper) ? (upper as TutorialAudience) : null;
}

export async function getTutorialSections(audience: TutorialAudience = "PHONE"): Promise<TutorialSectionData[]> {
  const supabase = createServiceRoleClient();
  const [{ data: sections }, { data: media }] = await Promise.all([
    supabase.from("tutorial_sections").select("id,title,position,created_at").eq("audience", audience).order("position").order("created_at"),
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

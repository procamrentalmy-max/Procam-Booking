"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getAuthContext, isAdmin } from "@/lib/auth/session";
import { BRANDING_BUCKET } from "@/lib/branding";
import { TUTORIAL_AUDIENCES, type TutorialAudience } from "@/lib/tutorials";
import { TUTORIAL_IMAGE_TYPES, TUTORIAL_MAX_BYTES, TUTORIAL_PATH_PREFIX, TUTORIAL_VIDEO_TYPES, tutorialKindOf } from "@/lib/tutorialMedia";

/**
 * Admin > Tutorials. Every action here uses the service-role client, which has no safety net of its own, so each one checks the caller
 * is an admin first. They return `{ error }` instead of throwing, because a thrown error never reaches the screen on production.
 */
type Result = { error?: string };
const NOT_ALLOWED: Result = { error: "Not authorized." };
const MAX_TITLE = 120;
const MAX_CAPTION = 300;

async function admin() {
  return isAdmin(await getAuthContext());
}

function refresh() {
  revalidatePath("/admin/tutorials", "layout");
  revalidatePath("/tutorial", "layout");
  revalidatePath("/", "layout");
}

export async function addSectionAction(title: string, audience: TutorialAudience): Promise<Result> {
  if (!(await admin())) return NOT_ALLOWED;
  if (!(TUTORIAL_AUDIENCES as readonly string[]).includes(audience)) return { error: "Unknown tutorial." };
  const clean = title.trim().slice(0, MAX_TITLE);
  if (!clean) return { error: "Type a header first." };
  const supabase = createServiceRoleClient();
  const { data: last } = await supabase.from("tutorial_sections").select("position").eq("audience", audience).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("tutorial_sections").insert({ title: clean, audience, position: (last?.position ?? -1) + 1 });
  if (error) return { error: `Could not add the header: ${error.message}` };
  refresh();
  return {};
}

export async function renameSectionAction(id: string, title: string): Promise<Result> {
  if (!(await admin())) return NOT_ALLOWED;
  const clean = title.trim().slice(0, MAX_TITLE);
  if (!clean) return { error: "A header can not be empty." };
  const { error } = await createServiceRoleClient().from("tutorial_sections").update({ title: clean }).eq("id", id);
  if (error) return { error: `Could not save the header: ${error.message}` };
  refresh();
  return {};
}

/** Moves a header one place up or down, by renumbering the whole list so the order is always exact. */
export async function moveSectionAction(id: string, direction: "up" | "down"): Promise<Result> {
  if (!(await admin())) return NOT_ALLOWED;
  const supabase = createServiceRoleClient();
  const { data: mine } = await supabase.from("tutorial_sections").select("audience").eq("id", id).maybeSingle();
  if (!mine) return { error: "Not found." };
  const { data: rows } = await supabase.from("tutorial_sections").select("id").eq("audience", mine.audience).order("position").order("created_at");
  const ids = (rows ?? []).map((r) => r.id);
  const i = ids.indexOf(id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return {};
  [ids[i], ids[j]] = [ids[j], ids[i]];
  for (let p = 0; p < ids.length; p++) await supabase.from("tutorial_sections").update({ position: p }).eq("id", ids[p]);
  refresh();
  return {};
}

export async function deleteSectionAction(id: string): Promise<Result> {
  if (!(await admin())) return NOT_ALLOWED;
  const supabase = createServiceRoleClient();
  const { data: media } = await supabase.from("tutorial_media").select("file_path").eq("section_id", id);
  const { error } = await supabase.from("tutorial_sections").delete().eq("id", id);
  if (error) return { error: `Could not delete the header: ${error.message}` };
  const paths = (media ?? []).map((m) => m.file_path);
  if (paths.length > 0) await supabase.storage.from(BRANDING_BUCKET).remove(paths).catch(() => {});
  refresh();
  return {};
}

/**
 * Step one of adding a photo or video: checks the file and hands the browser a one-time link to send it straight to storage (a video is
 * far too big to pass through the website's own servers). Step two, `addMediaAction`, puts it under the header.
 */
export async function prepareUploadAction(input: { contentType: string; size: number }): Promise<{ error: string } | { path: string; token: string }> {
  if (!(await admin())) return NOT_ALLOWED as { error: string };
  const kind = tutorialKindOf(input.contentType);
  if (!kind) return { error: "Use a PNG, JPEG, WebP or GIF photo, or an MP4, WebM or MOV video." };
  if (input.size > TUTORIAL_MAX_BYTES) return { error: `That file is over ${Math.round(TUTORIAL_MAX_BYTES / 1024 / 1024)} MB, the most the storage takes. Shorten or compress the video.` };
  const ext = TUTORIAL_IMAGE_TYPES[input.contentType] ?? TUTORIAL_VIDEO_TYPES[input.contentType];
  const path = `${TUTORIAL_PATH_PREFIX}${randomUUID()}.${ext}`;
  const { data, error } = await createServiceRoleClient().storage.from(BRANDING_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: `Could not start the upload: ${error?.message ?? "no link"}` };
  return { path: data.path, token: data.token };
}

const PATH_PATTERN = new RegExp(`^${TUTORIAL_PATH_PREFIX}[0-9a-f-]{36}\\.(png|jpg|webp|gif|mp4|webm|mov)$`);

/** Step two: the file is in storage; put it at the end of the header. */
export async function addMediaAction(input: { sectionId: string; path: string; contentType: string; caption?: string }): Promise<Result> {
  if (!(await admin())) return NOT_ALLOWED;
  const kind = tutorialKindOf(input.contentType);
  if (!kind || !PATH_PATTERN.test(input.path)) return { error: "That file is not a tutorial photo or video." };
  const supabase = createServiceRoleClient();
  const { data: last } = await supabase.from("tutorial_media").select("position").eq("section_id", input.sectionId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("tutorial_media").insert({
    section_id: input.sectionId,
    kind,
    file_path: input.path,
    caption: input.caption?.trim().slice(0, MAX_CAPTION) || null,
    position: (last?.position ?? -1) + 1,
  });
  if (error) {
    await supabase.storage.from(BRANDING_BUCKET).remove([input.path]).catch(() => {});
    return { error: `Could not add it: ${error.message}` };
  }
  refresh();
  return {};
}

export async function setCaptionAction(id: string, caption: string): Promise<Result> {
  if (!(await admin())) return NOT_ALLOWED;
  const { error } = await createServiceRoleClient().from("tutorial_media").update({ caption: caption.trim().slice(0, MAX_CAPTION) || null }).eq("id", id);
  if (error) return { error: `Could not save the caption: ${error.message}` };
  refresh();
  return {};
}

export async function moveMediaAction(id: string, direction: "up" | "down"): Promise<Result> {
  if (!(await admin())) return NOT_ALLOWED;
  const supabase = createServiceRoleClient();
  const { data: me } = await supabase.from("tutorial_media").select("section_id").eq("id", id).maybeSingle();
  if (!me) return { error: "Not found." };
  const { data: rows } = await supabase.from("tutorial_media").select("id").eq("section_id", me.section_id).order("position").order("created_at");
  const ids = (rows ?? []).map((r) => r.id);
  const i = ids.indexOf(id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return {};
  [ids[i], ids[j]] = [ids[j], ids[i]];
  for (let p = 0; p < ids.length; p++) await supabase.from("tutorial_media").update({ position: p }).eq("id", ids[p]);
  refresh();
  return {};
}

export async function deleteMediaAction(id: string): Promise<Result> {
  if (!(await admin())) return NOT_ALLOWED;
  const supabase = createServiceRoleClient();
  const { data: me } = await supabase.from("tutorial_media").select("file_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("tutorial_media").delete().eq("id", id);
  if (error) return { error: `Could not delete it: ${error.message}` };
  if (me?.file_path) await supabase.storage.from(BRANDING_BUCKET).remove([me.file_path]).catch(() => {});
  refresh();
  return {};
}

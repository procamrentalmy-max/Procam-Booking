/** What the Tutorial page accepts, shared by the admin upload screen (browser) and the server actions that check it. */
/** The public storage bucket the files go in (the same one the logo and the landing pictures use). */
export const TUTORIAL_BUCKET = "branding";
export const TUTORIAL_PATH_PREFIX = "tutorial/";

export const TUTORIAL_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const TUTORIAL_VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/** Photos are shrunk in the browser before they are sent (phone photos are several thousand pixels across); this is the widest one that is kept. */
export const TUTORIAL_IMAGE_MAX_WIDTH = 1600;
/** The biggest single file the storage allows on the current Supabase plan (50 MB on the free plan). */
export const TUTORIAL_MAX_BYTES = 50 * 1024 * 1024;

export function tutorialKindOf(contentType: string): "image" | "video" | null {
  if (contentType in TUTORIAL_IMAGE_TYPES) return "image";
  if (contentType in TUTORIAL_VIDEO_TYPES) return "video";
  return null;
}

export type TutorialMediaItem = { id: string; kind: "image" | "video"; url: string; caption: string | null };
export type TutorialSectionData = { id: string; title: string; media: TutorialMediaItem[] };

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { inputClass, pressableClass, primaryButtonClass } from "@/components/formStyles";
import { TUTORIAL_BUCKET, TUTORIAL_IMAGE_MAX_WIDTH, TUTORIAL_MAX_BYTES, tutorialKindOf, type TutorialSectionData } from "@/lib/tutorialMedia";
import {
  addMediaAction,
  addSectionAction,
  deleteMediaAction,
  deleteSectionAction,
  moveMediaAction,
  moveSectionAction,
  prepareUploadAction,
  renameSectionAction,
  setCaptionAction,
} from "./actions";

/** Shrinks a photo in the browser before it is sent: phone photos are several thousand pixels across and would make the page slow. GIFs are left alone. */
async function shrinkImage(file: File): Promise<{ blob: Blob; contentType: string }> {
  if (file.type === "image/gif") return { blob: file, contentType: file.type };
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  if (bitmap.width <= TUTORIAL_IMAGE_MAX_WIDTH && file.size <= 1.5 * 1024 * 1024) {
    bitmap.close();
    return { blob: file, contentType: file.type };
  }
  const scale = Math.min(1, TUTORIAL_IMAGE_MAX_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
  if (blob && blob.type === "image/webp") return { blob, contentType: "image/webp" };
  const jpeg: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!jpeg) return { blob: file, contentType: file.type };
  return { blob: jpeg, contentType: "image/jpeg" };
}

function SmallButton({ children, onClick, disabled, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${pressableClass}`}>
      {children}
    </button>
  );
}

function MediaCard({ item, first, last, busy, run }: { item: TutorialSectionData["media"][number]; first: boolean; last: boolean; busy: boolean; run: (fn: () => Promise<{ error?: string }>) => void }) {
  const [caption, setCaption] = useState(item.caption ?? "");
  return (
    <li className="space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex max-h-56 justify-center overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
        {item.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
          <img src={item.url} alt={item.caption ?? ""} className="max-h-56 w-auto max-w-full object-contain" />
        ) : (
          <video src={item.url} controls playsInline preload="metadata" className="max-h-56 w-auto max-w-full" />
        )}
      </div>
      <div className="flex gap-2">
        <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)" maxLength={300} className={`${inputClass} min-w-0 flex-1`} />
        <SmallButton disabled={busy || caption === (item.caption ?? "")} onClick={() => run(() => setCaptionAction(item.id, caption))}>
          Save
        </SmallButton>
      </div>
      <div className="flex flex-wrap gap-2">
        <SmallButton disabled={busy || first} title="Show this earlier" onClick={() => run(() => moveMediaAction(item.id, "up"))}>
          ↑ Earlier
        </SmallButton>
        <SmallButton disabled={busy || last} title="Show this later" onClick={() => run(() => moveMediaAction(item.id, "down"))}>
          ↓ Later
        </SmallButton>
        <SmallButton
          disabled={busy}
          onClick={() => {
            if (window.confirm("Delete this " + item.kind + "? It is removed from the Tutorial page.")) run(() => deleteMediaAction(item.id));
          }}
        >
          Delete
        </SmallButton>
      </div>
    </li>
  );
}

function SectionCard({ section, index, count, busy, run, upload, uploading, status }: {
  section: TutorialSectionData;
  index: number;
  count: number;
  busy: boolean;
  run: (fn: () => Promise<{ error?: string }>) => void;
  upload: (sectionId: string, files: FileList) => void;
  uploading: boolean;
  status: string[];
}) {
  const [title, setTitle] = useState(section.title);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <section className="space-y-4 rounded-2xl border border-zinc-300 p-4 dark:border-zinc-700">
      <div className="flex flex-wrap items-center gap-2">
        <SmallButton disabled={busy || index === 0} title="Move this header up" onClick={() => run(() => moveSectionAction(section.id, "up"))}>
          ↑
        </SmallButton>
        <SmallButton disabled={busy || index === count - 1} title="Move this header down" onClick={() => run(() => moveSectionAction(section.id, "down"))}>
          ↓
        </SmallButton>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label="Header" className={`${inputClass} min-w-0 flex-1 text-base font-semibold`} />
        <SmallButton disabled={busy || title.trim() === section.title || !title.trim()} onClick={() => run(() => renameSectionAction(section.id, title))}>
          Save header
        </SmallButton>
        <SmallButton
          disabled={busy}
          onClick={() => {
            if (window.confirm(`Delete the header "${section.title}" and its ${section.media.length} photo(s) and video(s)?`)) run(() => deleteSectionAction(section.id));
          }}
        >
          Delete header
        </SmallButton>
      </div>

      {section.media.length === 0 ? (
        <p className="text-sm text-zinc-500">No photos or videos under this header yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {section.media.map((m, i) => (
            <MediaCard key={m.id + (m.caption ?? "")} item={m} first={i === 0} last={i === section.media.length - 1} busy={busy} run={run} />
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          disabled={uploading}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) upload(section.id, e.target.files);
            if (fileRef.current) fileRef.current.value = "";
          }}
          className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-black file:px-3 file:py-2 file:text-sm file:font-medium file:text-white dark:file:bg-white dark:file:text-black"
        />
        {status.length > 0 && (
          <ul className="space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
            {status.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Admin > Tutorials: headers, and the photos and videos under each, in the order they show on the Tutorial page. */
export function TutorialsEditor({ sections }: { sections: TutorialSectionData[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, string[]>>({});

  function run(fn: () => Promise<{ error?: string }>) {
    setBusy(true);
    setMessage(null);
    fn()
      .then((r) => {
        if (r.error) setMessage(r.error);
        else router.refresh();
      })
      .catch(() => setMessage("Something went wrong. Try again."))
      .finally(() => setBusy(false));
  }

  async function upload(sectionId: string, files: FileList) {
    setUploadingId(sectionId);
    setMessage(null);
    const lines: string[] = [];
    const show = () => setStatus((s) => ({ ...s, [sectionId]: [...lines] }));
    const supabase = createBrowserSupabaseClient();
    for (const file of Array.from(files)) {
      const idx = lines.push(`${file.name}: preparing…`) - 1;
      show();
      try {
        const kind = tutorialKindOf(file.type);
        if (!kind) throw new Error("Use a PNG, JPEG, WebP or GIF photo, or an MP4, WebM or MOV video.");
        const { blob, contentType } = kind === "image" ? await shrinkImage(file) : { blob: file as Blob, contentType: file.type };
        if (blob.size > TUTORIAL_MAX_BYTES) throw new Error(`over ${Math.round(TUTORIAL_MAX_BYTES / 1024 / 1024)} MB, the most the storage takes`);
        lines[idx] = `${file.name}: uploading ${(blob.size / 1024 / 1024).toFixed(1)} MB…`;
        show();
        const prepared = await prepareUploadAction({ contentType, size: blob.size });
        if ("error" in prepared) throw new Error(prepared.error);
        const { error: upError } = await supabase.storage.from(TUTORIAL_BUCKET).uploadToSignedUrl(prepared.path, prepared.token, blob, { contentType });
        if (upError) throw new Error(upError.message);
        const added = await addMediaAction({ sectionId, path: prepared.path, contentType });
        if (added.error) throw new Error(added.error);
        lines[idx] = `${file.name}: added ✓`;
      } catch (e) {
        lines[idx] = `${file.name}: failed (${e instanceof Error ? e.message : "error"})`;
      }
      show();
    }
    setUploadingId(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const title = newTitle;
          run(async () => {
            const r = await addSectionAction(title);
            if (!r.error) setNewTitle("");
            return r;
          });
        }}
      >
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={120} placeholder="New header, for example How to fly the Neo 2" className={`${inputClass} min-w-0 flex-1`} />
        <button type="submit" disabled={busy || !newTitle.trim()} className={`${primaryButtonClass} disabled:opacity-50`}>
          Add header
        </button>
      </form>

      {message && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{message}</p>}

      {sections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">No headers yet. Add the first one above, then add photos and videos under it.</p>
      ) : (
        sections.map((s, i) => (
          <SectionCard key={s.id} section={s} index={i} count={sections.length} busy={busy} run={run} upload={upload} uploading={uploadingId === s.id} status={status[s.id] ?? []} />
        ))
      )}
    </div>
  );
}

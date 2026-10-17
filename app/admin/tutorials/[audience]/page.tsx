import Link from "next/link";
import { notFound } from "next/navigation";
import { audienceFromSlug, getTutorialSections } from "@/lib/tutorials";
import { TutorialsEditor } from "../TutorialsEditor";

export const dynamic = "force-dynamic";

export default async function AdminTutorialEditorPage({ params }: { params: Promise<{ audience: string }> }) {
  const { audience: slug } = await params;
  const audience = audienceFromSlug(slug);
  if (!audience) notFound();
  const sections = await getTutorialSections(audience);
  const name = audience === "CONTROLLER" ? "Controller" : "Phone";
  return (
    <div className="max-w-3xl space-y-6 pt-4 pb-10">
      <div>
        <Link href="/admin/tutorials" className="inline-flex min-h-10 items-center text-sm font-medium text-zinc-600 dark:text-zinc-400">
          ← Tutorials
        </Link>
        <h1 className="text-lg font-semibold">{name} tutorial</h1>
        <p className="text-sm text-zinc-500">
          The {name.toLowerCase()} tutorial: what customers see when they choose Use {name} on the Tutorial page. Add as many headers as you like, and under each header as many photos and videos as you like. They show in the order
          you set here, each one whole and sized to fit a phone. Photos are shrunk to a sensible size automatically. Videos: MP4, WebM or MOV, up to 50 MB each (MP4 plays everywhere). The home page only links to the
          Tutorial once there is at least one photo or video.
        </p>
        <p className="mt-1 text-sm">
          <a href={`/tutorial/${slug.toLowerCase()}`} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            Open the {name.toLowerCase()} tutorial
          </a>
        </p>
      </div>
      <TutorialsEditor sections={sections} audience={audience} />
    </div>
  );
}

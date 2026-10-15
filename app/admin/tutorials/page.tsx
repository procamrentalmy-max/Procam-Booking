import { getTutorialSections } from "@/lib/tutorials";
import { TutorialsEditor } from "./TutorialsEditor";

export const dynamic = "force-dynamic";

export default async function AdminTutorialsPage() {
  const sections = await getTutorialSections();
  return (
    <div className="max-w-3xl space-y-6 pt-4 pb-10">
      <div>
        <h1 className="text-lg font-semibold">Tutorials</h1>
        <p className="text-sm text-zinc-500">
          The Tutorial page customers can open from the home page. Add as many headers as you like, and under each header as many photos and videos as you like. They show in the order
          you set here, each one whole and sized to fit a phone. Photos are shrunk to a sensible size automatically. Videos: MP4, WebM or MOV, up to 50 MB each (MP4 plays everywhere). The home page only links to the
          Tutorial once there is at least one photo or video.
        </p>
        <p className="mt-1 text-sm">
          <a href="/tutorial" target="_blank" rel="noreferrer" className="underline underline-offset-2">
            Open the Tutorial page
          </a>
        </p>
      </div>
      <TutorialsEditor sections={sections} />
    </div>
  );
}

import Link from "next/link";
import { getTutorialSections, type TutorialAudience } from "@/lib/tutorials";

export const dynamic = "force-dynamic";

const CARDS: { audience: TutorialAudience; slug: string; title: string; note: string }[] = [
  { audience: "PHONE", slug: "phone", title: "Phone tutorial", note: "Shown when a customer taps Use Phone: how to fly with their own phone." },
  { audience: "CONTROLLER", slug: "controller", title: "Controller tutorial", note: "Shown when a customer taps Use Controller: how to fly with the controller." },
];

/** Admin > Tutorials: the Tutorial page has two tutorials, so pick which one to edit. */
export default async function AdminTutorialsPage() {
  const counts = await Promise.all(CARDS.map(async (c) => (await getTutorialSections(c.audience)).length));
  return (
    <div className="max-w-3xl space-y-6 pt-4 pb-10">
      <div>
        <h1 className="text-lg font-semibold">Tutorials</h1>
        <p className="text-sm text-zinc-500">
          Customers who open the Tutorial page are asked how they will fly and choose between two tutorials. Each one has its own headers, photos and videos. The home page only links to the Tutorial once there is at least one photo or video.
        </p>
        <p className="mt-1 text-sm">
          <a href="/tutorial" target="_blank" rel="noreferrer" className="underline underline-offset-2">
            Open the Tutorial page
          </a>
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map((c, i) => (
          <Link key={c.slug} href={`/admin/tutorials/${c.slug}`} className="rounded-xl border border-zinc-200 p-4 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600">
            <p className="font-medium text-black dark:text-zinc-50">{c.title}</p>
            <p className="text-sm text-zinc-500">{c.note}</p>
            <p className="mt-2 text-xs text-zinc-500">
              {counts[i]} header{counts[i] === 1 ? "" : "s"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

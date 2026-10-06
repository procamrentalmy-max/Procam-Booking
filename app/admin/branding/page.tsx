import { getLandingImageUrls, getLogoUrl, type LandingImageSlot } from "@/lib/branding";
import { inputClass, primaryButtonClass, dangerButtonClass } from "@/components/formStyles";
import { uploadLogoAction, removeLogoAction, uploadLandingImageAction, removeLandingImageAction } from "./actions";

const PICTURES: { slot: LandingImageSlot; title: string; note: string }[] = [
  { slot: "hero", title: "Picture at the top of the landing page", note: "Shown big in the top part of the home page, beside the headline. A landscape or square picture works best. Until you upload one, the drawn drone is shown." },
  { slot: "kit", title: "Picture beside \"What is in the kit\"", note: "Shown next to the kit text further down the home page. Until you upload one, that section is just the text." },
];

export default async function BrandingPage() {
  const [logoUrl, pictureUrls] = await Promise.all([getLogoUrl(), getLandingImageUrls()]);

  return (
    <div className="max-w-lg space-y-6 pt-4 pb-10">
      <div>
        <h1 className="text-lg font-semibold">Branding</h1>
        <p className="text-sm text-zinc-500">
          The logo shown on the customer site, booking flow, and admin/staff header. PNG, JPEG, WebP, or SVG, under
          2MB. Until you upload one, the default camera mark is shown instead.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">Current logo</p>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local optimizable asset
          <img src={logoUrl} alt="Current logo" className="h-16 w-auto" />
        ) : (
          <p className="text-sm text-zinc-500">No logo uploaded yet.</p>
        )}
      </div>

      <form action={uploadLogoAction} className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <label className="block text-sm font-medium">Upload a new logo</label>
        <input
          type="file"
          name="logo"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          required
          className={`w-full ${inputClass}`}
        />
        <button type="submit" className={primaryButtonClass}>
          Upload
        </button>
      </form>

      {logoUrl && (
        <form action={removeLogoAction}>
          <button type="submit" className={dangerButtonClass}>
            Remove logo (use default mark)
          </button>
        </form>
      )}

      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Landing page pictures</h2>
        <p className="text-sm text-zinc-500">PNG, JPEG or WebP, under 8MB. Big photos are shrunk automatically, so you can upload straight from your phone.</p>
      </div>

      {PICTURES.map(({ slot, title, note }) => (
        <div key={slot} className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-zinc-500">{note}</p>
          </div>
          {pictureUrls[slot] ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local optimizable asset
            <img src={pictureUrls[slot]!} alt={title} className="max-h-48 w-auto rounded-lg border border-zinc-200 dark:border-zinc-800" />
          ) : (
            <p className="text-sm text-zinc-500">No picture uploaded yet.</p>
          )}
          <form action={uploadLandingImageAction} className="space-y-3">
            <input type="hidden" name="slot" value={slot} />
            <input type="file" name="picture" accept="image/png,image/jpeg,image/webp" required className={`w-full ${inputClass}`} />
            <button type="submit" className={primaryButtonClass}>
              {pictureUrls[slot] ? "Replace picture" : "Upload picture"}
            </button>
          </form>
          {pictureUrls[slot] && (
            <form action={removeLandingImageAction}>
              <input type="hidden" name="slot" value={slot} />
              <button type="submit" className={dangerButtonClass}>
                Remove picture
              </button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}

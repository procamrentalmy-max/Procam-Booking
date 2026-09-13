import { getLogoUrl } from "@/lib/branding";
import { inputClass, primaryButtonClass, dangerButtonClass } from "@/components/formStyles";
import { uploadLogoAction, removeLogoAction } from "./actions";

export default async function BrandingPage() {
  const logoUrl = await getLogoUrl();

  return (
    <div className="max-w-lg space-y-6 pt-4">
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
    </div>
  );
}

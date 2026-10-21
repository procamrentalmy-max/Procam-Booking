import { DAILY_RENTAL_ENABLED } from "@/lib/features";
import { getComboPictureUrls, getLandingImageUrls, getLogoUrl, getPayQrUrl, type LandingImageSlot } from "@/lib/branding";
import { BATTERY_OPTIONS, DAILY_BATTERIES, DRONE_MODEL_PROFILES, ENABLED_DRONE_MODELS, comboKey, controllerLabel, hasDailyRate } from "@/lib/droneRental/pricingRules";
import { inputClass, primaryButtonClass, dangerButtonClass } from "@/components/formStyles";
import { uploadLogoAction, removeLogoAction, uploadLandingImageAction, removeLandingImageAction, uploadComboPictureAction, removeComboPictureAction, uploadPayQrAction, removePayQrAction } from "./actions";

const PICTURES: { slot: LandingImageSlot; title: string; note: string }[] = [
  { slot: "hero", title: "Picture at the top of the landing page", note: "Shown big in the top part of the home page, beside the headline. A landscape or square picture works best. Until you upload one, the drawn drone is shown." },
  { slot: "kit", title: "Picture beside \"What is in the kit\"", note: "Shown next to the kit text further down the home page. Until you upload one, that section is just the text." },
];

export default async function BrandingPage() {
  const [logoUrl, pictureUrls, comboUrls, payQrUrl] = await Promise.all([getLogoUrl(), getLandingImageUrls(), getComboPictureUrls(), getPayQrUrl()]);
  // Every combination a customer can book: drone x how it is flown x batteries.
  const combos = ENABLED_DRONE_MODELS.flatMap((model) =>
    DRONE_MODEL_PROFILES[model].controllerOptions.flatMap((controller) =>
      BATTERY_OPTIONS.map((batteries) => ({
        model,
        controller,
        batteries,
        title: `${DRONE_MODEL_PROFILES[model].shortName} · ${controllerLabel(model, controller)} · ${batteries} ${batteries === 1 ? "battery" : "batteries"}`,
      }))
    )
  );

  // The daily rental has its own kit (3 batteries and a charger), so its pictures are separate: drone x how it is flown, where a daily rate exists.
  const dailyCombos = ENABLED_DRONE_MODELS.flatMap((model) =>
    DRONE_MODEL_PROFILES[model].controllerOptions
      .filter((controller) => hasDailyRate(model, controller))
      .map((controller) => ({
        model,
        controller,
        batteries: DAILY_BATTERIES as number,
        title: `${DRONE_MODEL_PROFILES[model].shortName} · ${controllerLabel(model, controller)} · 3 batteries and a charger`,
      }))
  );

  const comboCards = (list: { model: string; controller: string; batteries: number; title: string }[]) =>
    list.map(({ model, controller, batteries, title }) => {
      const url = comboUrls[comboKey(model, controller, batteries)];
      return (
        <div key={title} className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm font-medium">{title}</p>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local optimizable asset
            <img src={url} alt={title} className="max-h-40 w-auto rounded-lg border border-zinc-200 dark:border-zinc-800" />
          ) : (
            <p className="text-sm text-zinc-500">No picture uploaded yet.</p>
          )}
          <form action={uploadComboPictureAction} className="space-y-3">
            <input type="hidden" name="model" value={model} />
            <input type="hidden" name="controller" value={controller} />
            <input type="hidden" name="batteries" value={batteries} />
            <input type="file" name="picture" accept="image/png,image/jpeg,image/webp" required className={`w-full ${inputClass}`} />
            <button type="submit" className={primaryButtonClass}>
              {url ? "Replace picture" : "Upload picture"}
            </button>
          </form>
          {url && (
            <form action={removeComboPictureAction}>
              <input type="hidden" name="model" value={model} />
              <input type="hidden" name="controller" value={controller} />
              <input type="hidden" name="batteries" value={batteries} />
              <button type="submit" className={dangerButtonClass}>
                Remove picture
              </button>
            </form>
          )}
        </div>
      );
    });

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

      <div className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div>
          <p className="text-sm font-medium">Payment QR (walk-in customers)</p>
          <p className="text-xs text-zinc-500">
            A walk-in customer can choose Pay by QR: after their card is saved for the deposit hold, this picture is shown whole (nothing cropped) for them to scan and pay. They then show the paid screen from
            their banking app to the merchant, who confirms it. Until you upload a picture, Pay by QR is not offered.
          </p>
        </div>
        {payQrUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a local optimizable asset
          <img src={payQrUrl} alt="Payment QR" className="h-auto w-full max-w-xs rounded-lg border border-zinc-200 dark:border-zinc-800" />
        ) : (
          <p className="text-sm text-zinc-500">No picture uploaded yet.</p>
        )}
        <form action={uploadPayQrAction} className="space-y-3">
          <input type="file" name="picture" accept="image/png,image/jpeg,image/webp" required className={`w-full ${inputClass}`} />
          <button type="submit" className={primaryButtonClass}>
            {payQrUrl ? "Replace picture" : "Upload picture"}
          </button>
        </form>
        {payQrUrl && (
          <form action={removePayQrAction}>
            <button type="submit" className={dangerButtonClass}>
              Remove picture
            </button>
          </form>
        )}
      </div>

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

      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Booking page pictures</h2>
        <p className="text-sm text-zinc-500">
          One picture for each combination a customer can book. It shows on the booking page when they pick that drone, controller and battery count, with the deposit under it. A combination with no picture shows just the deposit.
        </p>
      </div>

      {comboCards(combos)}

      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Daily rental pictures</h2>
        {!DAILY_RENTAL_ENABLED && <p className="mt-1 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">Renting by the day is switched off for now, so customers do not see these pictures yet. You can still upload them.</p>}
        <p className="text-sm text-zinc-500">
          The daily rental comes with 3 batteries and a charger, so it has its own pictures: one for each drone and way of flying (the Goggles set is hourly only). It shows on the booking page, the shop QR order page and the price picker on the home page when
          a customer chooses By the day, with the deposit under it. Show the drone with its 3 batteries and the charger. A combination with no picture shows just the deposit.
        </p>
      </div>

      {comboCards(dailyCombos)}
    </div>
  );
}

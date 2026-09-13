import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateQrDataUrl } from "@/lib/qr";
import { partnerLandingUrl } from "@/lib/urls";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { createPartnerAction, updatePartnerAction } from "./actions";

export default async function PartnersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: partners } = await supabase.from("partners").select("*").order("created_at", { ascending: true });

  const rows = await Promise.all(
    (partners ?? []).map(async (p) => ({
      ...p,
      qr: await generateQrDataUrl(partnerLandingUrl(p.referral_code)),
      url: partnerLandingUrl(p.referral_code),
    }))
  );

  return (
    <div className="space-y-6 pt-4">
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">New Partner</h2>
        <form action={createPartnerAction} className="grid gap-2 sm:grid-cols-2">
          <input name="name" placeholder="Property name" required className={inputClass} />
          <input name="address" placeholder="Address" required className={inputClass} />
          <input
            name="commissionRate"
            type="number"
            step="0.01"
            min="0"
            max="1"
            defaultValue="0.20"
            required
            className={inputClass}
          />
          <input name="referralCode" placeholder="Referral code, e.g. ABC123" required className={inputClass} />
          <input
            name="googleMapsUrl"
            type="url"
            placeholder="Google Maps link (optional)"
            className={`${inputClass} sm:col-span-2`}
          />
          <button type="submit" className={`${primaryButtonClass} sm:col-span-2`}>
            Create Partner
          </button>
        </form>
      </section>

      <section className="space-y-4">
        {rows.map((p) => (
          <div
            key={p.id}
            className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-4 sm:flex-row sm:items-center dark:border-zinc-800"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, next/image can't optimize it */}
            <img src={p.qr} alt={`QR code for ${p.name}`} className="h-24 w-24" />
            <div className="flex-1">
              <p className="font-medium">
                {p.human_id} — {p.name}
              </p>
              <p className="text-sm text-zinc-500">{p.address}</p>
              <p className="text-xs text-zinc-400">{p.url}</p>
              {p.google_maps_url && (
                <a
                  href={p.google_maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-zinc-400 underline underline-offset-2"
                >
                  Google Maps
                </a>
              )}
            </div>
            {/*
              Keyed on every editable field: the outer row's key (p.id)
              never changes across a save, so without this React reuses the
              same input/select DOM nodes and never re-applies their
              defaultValue from fresh server data after a successful save.
            */}
            <form
              key={`${p.commission_rate}:${p.status}:${p.google_maps_url ?? ""}:${p.photo_print_complimentary}`}
              action={updatePartnerAction}
              className="flex flex-wrap items-center gap-2"
            >
              <input type="hidden" name="id" value={p.id} />
              <input
                name="commissionRate"
                type="number"
                step="0.01"
                min="0"
                max="1"
                defaultValue={p.commission_rate}
                className={`${inputClass} w-20`}
              />
              <select name="status" defaultValue={p.status} className={inputClass}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
              <input
                name="googleMapsUrl"
                type="url"
                placeholder="Google Maps link"
                defaultValue={p.google_maps_url ?? ""}
                className={`${inputClass} w-48`}
              />
              <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  name="photoPrintComplimentary"
                  defaultChecked={p.photo_print_complimentary}
                />
                Complimentary photo prints
              </label>
              <button type="submit" className={primaryButtonClass}>
                Save
              </button>
            </form>
          </div>
        ))}
      </section>
    </div>
  );
}

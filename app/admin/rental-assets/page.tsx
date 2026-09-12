import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ALL_ASSET_STATUSES } from "@/lib/state-machine/asset";
import { inputClass, primaryButtonClass, dangerButtonClass } from "@/components/formStyles";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { createAssetAction, updateAssetAction, transitionAssetAction, deleteAssetAction } from "./actions";

export default async function RentalAssetsPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: assets }, { data: partners }, { data: products }] = await Promise.all([
    // RETIRED = deleted from every admin/customer view (see deleteAssetAction) — leave them out of the list entirely.
    supabase.from("rental_assets").select("*").neq("status", "RETIRED").order("human_id", { ascending: true }),
    supabase.from("partners").select("id,name").order("name", { ascending: true }),
    supabase.from("rental_products").select("id,customer_facing_name").order("customer_facing_name"),
  ]);

  const partnerName = new Map((partners ?? []).map((p) => [p.id, p.name]));
  const productName = new Map((products ?? []).map((p) => [p.id, p.customer_facing_name]));

  return (
    <div className="space-y-6 pt-4">
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">New Rental Asset</h2>
        <form action={createAssetAction} className="grid gap-2 sm:grid-cols-5">
          <select name="productId" required className={inputClass}>
            <option value="">Product…</option>
            {(products ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.customer_facing_name}
              </option>
            ))}
          </select>
          <input name="model" placeholder="Model" required className={inputClass} />
          <input name="serialNumber" placeholder="Serial number" required className={inputClass} />
          <select name="partnerId" defaultValue="" className={inputClass}>
            <option value="">Backup fleet (no property)</option>
            {(partners ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="submit" className={primaryButtonClass}>
            Add Asset
          </button>
        </form>
      </section>

      <section className="space-y-3">
        {(assets ?? []).map((asset) => (
          <div key={asset.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="font-medium">
              {asset.human_id} — {asset.model}{" "}
              <span className="text-sm text-zinc-500">({asset.serial_number})</span>
            </p>
            <p className="text-sm text-zinc-500">
              {productName.get(asset.product_id) ?? "Unknown product"} —{" "}
              {asset.partner_id ? partnerName.get(asset.partner_id) ?? "Unknown property" : "Backup fleet"} —{" "}
              <span className="font-medium">{asset.status}</span>
            </p>

            <div className="mt-3 flex flex-wrap gap-4">
              <form action={transitionAssetAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={asset.id} />
                <select name="toStatus" defaultValue={asset.status} className={inputClass}>
                  {ALL_ASSET_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button type="submit" className={primaryButtonClass}>
                  Change Status
                </button>
              </form>

              <form action={updateAssetAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={asset.id} />
                <select name="partnerId" defaultValue={asset.partner_id ?? ""} className={inputClass}>
                  <option value="">Backup fleet (no property)</option>
                  {(partners ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input name="notes" placeholder="Notes" defaultValue={asset.notes ?? ""} className={inputClass} />
                <button type="submit" className={primaryButtonClass}>
                  Save
                </button>
              </form>

              <form action={deleteAssetAction}>
                <input type="hidden" name="id" value={asset.id} />
                <ConfirmSubmitButton
                  confirmMessage={`Delete ${asset.human_id} (${asset.model})? This retires it permanently — it can't be undone.`}
                  className={dangerButtonClass}
                >
                  Delete
                </ConfirmSubmitButton>
              </form>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

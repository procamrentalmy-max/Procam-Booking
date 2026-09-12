import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inputClass, primaryButtonClass, dangerButtonClass } from "@/components/formStyles";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { EditModeProvider, DeleteGate } from "@/components/EditMode";
import { createRentalPackageAction, updateRentalPackageAction, deleteRentalPackageAction } from "./actions";

export default async function RentalPackagesPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: packages }, { data: products }] = await Promise.all([
    supabase.from("rental_packages").select("*").order("duration_minutes", { ascending: true }),
    supabase.from("rental_products").select("id,customer_facing_name").order("customer_facing_name"),
  ]);

  const productName = new Map((products ?? []).map((p) => [p.id, p.customer_facing_name]));

  return (
    <div className="space-y-6 pt-4">
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">New Package</h2>
        <form action={createRentalPackageAction} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          <select name="productId" required className={inputClass}>
            <option value="">Product…</option>
            {(products ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.customer_facing_name}
              </option>
            ))}
          </select>
          <input name="name" placeholder="Name" required className={`${inputClass} col-span-2 sm:col-span-1`} />
          <input name="durationMinutes" type="number" placeholder="Minutes" required min={1} className={inputClass} />
          <input name="priceMyr" type="number" step="0.01" placeholder="Price RM" required min={0} className={inputClass} />
          <input name="depositMyr" type="number" step="0.01" placeholder="Deposit RM" required min={0} className={inputClass} />
          <input
            name="lateFeePerHourMyr"
            type="number"
            step="0.01"
            placeholder="Late fee RM/hr"
            required
            min={0}
            className={inputClass}
          />
          <button type="submit" className={`${primaryButtonClass} col-span-2 sm:col-span-6`}>
            Create Package
          </button>
        </form>
      </section>

      <EditModeProvider>
        <section className="space-y-4">
          {(packages ?? []).map((pkg) => (
            <div key={pkg.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
              <form action={updateRentalPackageAction} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-7">
                <input type="hidden" name="id" value={pkg.id} />
                <select name="productId" defaultValue={pkg.product_id} className={inputClass}>
                  {(products ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.customer_facing_name}
                    </option>
                  ))}
                </select>
                <input name="name" defaultValue={pkg.name} className={`${inputClass} col-span-2 sm:col-span-1`} />
                <input
                  name="durationMinutes"
                  type="number"
                  defaultValue={pkg.duration_minutes}
                  min={1}
                  className={inputClass}
                />
                <input
                  name="priceMyr"
                  type="number"
                  step="0.01"
                  defaultValue={pkg.price_myr}
                  min={0}
                  className={inputClass}
                />
                <input
                  name="depositMyr"
                  type="number"
                  step="0.01"
                  defaultValue={pkg.deposit_myr}
                  min={0}
                  className={inputClass}
                />
                <input
                  name="lateFeePerHourMyr"
                  type="number"
                  step="0.01"
                  defaultValue={pkg.late_fee_per_hour_myr}
                  min={0}
                  className={inputClass}
                />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-sm">
                    <input type="checkbox" name="active" defaultChecked={pkg.active} /> Active
                  </label>
                  <button type="submit" className={primaryButtonClass}>
                    Save
                  </button>
                </div>
                <p className="col-span-2 text-xs text-zinc-400 sm:col-span-7">
                  {productName.get(pkg.product_id) ?? "Unknown product"}
                </p>
              </form>

              <DeleteGate>
                <form action={deleteRentalPackageAction} className="mt-2">
                  <input type="hidden" name="id" value={pkg.id} />
                  <ConfirmSubmitButton
                    confirmMessage={`Delete "${pkg.name}"? This can't be undone.`}
                    className={dangerButtonClass}
                  >
                    Delete
                  </ConfirmSubmitButton>
                </form>
              </DeleteGate>
            </div>
          ))}
        </section>
      </EditModeProvider>
    </div>
  );
}

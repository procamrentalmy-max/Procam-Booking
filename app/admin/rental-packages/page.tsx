import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { createRentalPackageAction, updateRentalPackageAction } from "./actions";

export default async function RentalPackagesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: packages } = await supabase
    .from("rental_packages")
    .select("*")
    .order("duration_minutes", { ascending: true });

  return (
    <div className="space-y-6 pt-4">
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">New Package</h2>
        <form action={createRentalPackageAction} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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
          <button type="submit" className={`${primaryButtonClass} col-span-2 sm:col-span-5`}>
            Create Package
          </button>
        </form>
      </section>

      <section className="space-y-4">
        {(packages ?? []).map((pkg) => (
          <form
            key={pkg.id}
            action={updateRentalPackageAction}
            className="grid grid-cols-2 items-center gap-2 rounded-xl border border-zinc-200 p-4 sm:grid-cols-6 dark:border-zinc-800"
          >
            <input type="hidden" name="id" value={pkg.id} />
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
          </form>
        ))}
      </section>
    </div>
  );
}

import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { addPhoneCompatibilityAction, deletePhoneCompatibilityAction } from "./actions";

export default async function PhoneCompatibilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: product } = await supabase
    .from("rental_products")
    .select("id,customer_facing_name")
    .eq("id", id)
    .maybeSingle();
  if (!product) notFound();

  const { data: entries } = await supabase
    .from("product_phone_compatibility")
    .select("*")
    .eq("product_id", id)
    .order("manufacturer", { ascending: true });

  return (
    <div className="space-y-6 pt-4">
      <h1 className="text-lg font-semibold">Phone Compatibility — {product.customer_facing_name}</h1>
      <p className="text-sm text-zinc-500">
        A phone not listed here is treated as not confirmed compatible and blocks booking. Leave variant blank to
        cover every variant of that model.
      </p>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">Add Entry</h2>
        <form action={addPhoneCompatibilityAction} className="grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="productId" value={product.id} />
          <input name="manufacturer" placeholder="Manufacturer, e.g. Apple" required className={inputClass} />
          <input name="model" placeholder="Model, e.g. iPhone 16 Pro Max" required className={inputClass} />
          <input name="variant" placeholder="Variant (optional)" className={inputClass} />
          <input name="notes" placeholder="Notes (optional)" className={inputClass} />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="compatible" defaultChecked /> Compatible
          </label>
          <button type="submit" className={`${primaryButtonClass} sm:col-span-2`}>
            Add
          </button>
        </form>
      </section>

      <section className="space-y-2">
        {(entries ?? []).map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800"
          >
            <div>
              <p className="font-medium">
                {entry.manufacturer} {entry.model} {entry.variant ? `(${entry.variant})` : ""}
              </p>
              <p className={entry.compatible ? "text-green-600" : "text-red-600"}>
                {entry.compatible ? "Compatible" : "Not compatible"}
                {entry.notes ? ` — ${entry.notes}` : ""}
              </p>
            </div>
            <form action={deletePhoneCompatibilityAction}>
              <input type="hidden" name="id" value={entry.id} />
              <input type="hidden" name="productId" value={product.id} />
              <button type="submit" className="text-xs text-zinc-400 underline underline-offset-2">
                Remove
              </button>
            </form>
          </div>
        ))}
        {!entries?.length && <p className="text-sm text-zinc-400">No entries yet.</p>}
      </section>
    </div>
  );
}

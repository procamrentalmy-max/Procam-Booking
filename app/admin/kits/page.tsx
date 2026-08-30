import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inputClass, primaryButtonClass } from "@/components/formStyles";
import { createKitAction, updateKitAction } from "./actions";

const KIT_STATUSES = ["AVAILABLE", "WITH_CUSTOMER", "AWAITING_INSPECTION", "MAINTENANCE", "RETIRED"] as const;

export default async function KitsPage() {
  const supabase = await createServerSupabaseClient();
  const [{ data: kits }, { data: partners }, { data: items }, { data: products }] = await Promise.all([
    supabase.from("kits").select("*").order("human_id", { ascending: true }),
    supabase.from("partners").select("id,name").order("name", { ascending: true }),
    supabase.from("kit_items").select("kit_id,item_name"),
    supabase.from("rental_products").select("id,customer_facing_name").order("customer_facing_name"),
  ]);

  const partnerName = new Map((partners ?? []).map((p) => [p.id, p.name]));
  const productName = new Map((products ?? []).map((p) => [p.id, p.customer_facing_name]));
  const itemsByKit = new Map<string, string[]>();
  for (const item of items ?? []) {
    itemsByKit.set(item.kit_id, [...(itemsByKit.get(item.kit_id) ?? []), item.item_name]);
  }

  return (
    <div className="space-y-6 pt-4">
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 text-sm font-semibold">New Kit</h2>
        <form action={createKitAction} className="grid gap-2 sm:grid-cols-4">
          <select name="productId" required className={inputClass}>
            <option value="">Product…</option>
            {(products ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.customer_facing_name}
              </option>
            ))}
          </select>
          <select name="partnerId" defaultValue="" className={inputClass}>
            <option value="">Backup fleet (no property)</option>
            {(partners ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            name="items"
            placeholder="Items, comma-separated"
            defaultValue="Selfie Stick, Wrist Strap, Protective Case, USB-C Charging Cable"
            className={`${inputClass} sm:col-span-2`}
          />
          <button type="submit" className={`${primaryButtonClass} sm:col-span-4`}>
            Add Kit
          </button>
        </form>
      </section>

      <section className="space-y-3">
        {(kits ?? []).map((kit) => (
          <form
            key={kit.id}
            action={updateKitAction}
            className="space-y-2 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <input type="hidden" name="id" value={kit.id} />
            <p className="font-medium">
              {kit.human_id} — {productName.get(kit.product_id) ?? "Unknown product"} —{" "}
              {kit.partner_id ? partnerName.get(kit.partner_id) ?? "Unknown property" : "Backup fleet"}
            </p>
            <div className="flex flex-wrap gap-2">
              <select name="partnerId" defaultValue={kit.partner_id ?? ""} className={inputClass}>
                <option value="">Backup fleet (no property)</option>
                {(partners ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select name="status" defaultValue={kit.status} className={inputClass}>
                {KIT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <input
              name="items"
              defaultValue={(itemsByKit.get(kit.id) ?? []).join(", ")}
              className={`${inputClass} w-full`}
            />
            <button type="submit" className={primaryButtonClass}>
              Save
            </button>
          </form>
        ))}
      </section>
    </div>
  );
}
